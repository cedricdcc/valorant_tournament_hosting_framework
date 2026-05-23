import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscordOrchestrationProcessor } from '../src/discord/discord-orchestration.processor.js';
import { DISCORD_MOVE_USERS_JOB } from '../src/discord/discord-orchestration.constants.js';

test('processor pauses queue and throws retryable error on Discord 429', async () => {
  let pauseCalls = 0;
  let resumeCalls = 0;

  const processor = new DiscordOrchestrationProcessor({
    async moveUsersToVoiceChannel() {
      const error = new Error('rate limited') as Error & {
        status?: number;
        retryAfterMs?: number;
      };
      error.status = 429;
      error.retryAfterMs = 1;
      throw error;
    },
  });

  const job = {
    name: DISCORD_MOVE_USERS_JOB,
    data: {
      guildId: 'guild-1',
      targetChannelId: 'vc-1',
      userIds: ['u1'],
    },
    queue: {
      async pause() {
        pauseCalls += 1;
      },
      async resume() {
        resumeCalls += 1;
      },
    },
  };

  await assert.rejects(
    processor.process(job as never),
    /Discord rate limit hit \(HTTP 429\); retrying with backoff after 1ms/,
  );

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(pauseCalls, 1);
  assert.equal(resumeCalls, 1);
});

test('processor rethrows non-429 errors without pausing queue', async () => {
  let pauseCalls = 0;

  const processor = new DiscordOrchestrationProcessor({
    async moveUsersToVoiceChannel() {
      const error = new Error('unexpected');
      throw error;
    },
  });

  const job = {
    name: DISCORD_MOVE_USERS_JOB,
    data: {
      guildId: 'guild-1',
      targetChannelId: 'vc-1',
      userIds: ['u1'],
    },
    queue: {
      async pause() {
        pauseCalls += 1;
      },
      async resume() {
        return;
      },
    },
  };

  await assert.rejects(processor.process(job as never), /unexpected/);
  assert.equal(pauseCalls, 0);
});
