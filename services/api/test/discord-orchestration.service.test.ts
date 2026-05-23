import test from 'node:test';
import assert from 'node:assert/strict';
import { DiscordOrchestrationService } from '../src/discord/discord-orchestration.service.js';
import { DISCORD_MOVE_USERS_JOB } from '../src/discord/discord-orchestration.constants.js';

test('enqueueMoveUsersTask pushes a move-users job to the queue', async () => {
  const added: Array<{ name: string; payload: unknown }> = [];

  const queueMock = {
    async add(name: string, payload: unknown) {
      added.push({ name, payload });
      return { id: 'job-1' };
    },
  };

  const service = new DiscordOrchestrationService(queueMock as never);
  const payload = {
    guildId: 'guild-1',
    targetChannelId: 'voice-channel-1',
    userIds: ['u1', 'u2'],
  };

  const job = await service.enqueueMoveUsersTask(payload);

  assert.equal((job as { id: string }).id, 'job-1');
  assert.deepEqual(added, [{ name: DISCORD_MOVE_USERS_JOB, payload }]);
});
