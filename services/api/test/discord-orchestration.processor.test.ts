import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscordOrchestrationProcessor } from '../src/discord/discord-orchestration.processor.js';
import { DISCORD_MOVE_USERS_JOB } from '../src/discord/discord-orchestration.constants.js';

class TestableProcessor extends DiscordOrchestrationProcessor {
  public rateLimitDelays: number[] = [];

  protected override async applyRateLimit(retryAfterMs: number): Promise<void> {
    this.rateLimitDelays.push(retryAfterMs);
  }
}

test('processor triggers worker rate-limit flow on Discord 429', async () => {
  const processor = new TestableProcessor({
    async moveUsersToVoiceChannel() {
      const error = new Error('rate limited') as Error & {
        status?: number;
        retryAfterMs?: number;
      };
      error.status = 429;
      error.retryAfterMs = 12;
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
  };

  await assert.rejects(processor.process(job as never));
  assert.deepEqual(processor.rateLimitDelays, [12]);
});

test('processor rethrows non-429 errors without rate-limiting', async () => {
  const processor = new TestableProcessor({
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
  };

  await assert.rejects(processor.process(job as never), /unexpected/);
  assert.equal(processor.rateLimitDelays.length, 0);
});
