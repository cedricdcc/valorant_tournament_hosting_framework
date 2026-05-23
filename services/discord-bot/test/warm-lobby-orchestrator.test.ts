import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WarmLobbyOrchestrator,
  type CleanupMatchVoicePayload,
  type QueueMatchVoicePayload,
} from '../src/warm-lobby-orchestrator.js';

function createQueuedMatchPayload(): QueueMatchVoicePayload {
  return {
    type: 'queue-match-voice',
    guildId: 'guild-1',
    matchId: 'match-1',
    warmLobbyChannelId: 'warm-1',
    categoryId: 'category-1',
    teams: [
      {
        teamId: 'team-a',
        channelName: 'Match 1 - Team A',
        userIds: ['1', '2', '3', '4', '5'],
      },
      {
        teamId: 'team-b',
        channelName: 'Match 1 - Team B',
        userIds: ['6', '7', '8', '9', '10'],
      },
    ],
  };
}

function createFinishedMatchPayload(): CleanupMatchVoicePayload {
  return {
    type: 'cleanup-match-voice',
    guildId: 'guild-1',
    matchId: 'match-1',
  };
}

test('WarmLobbyOrchestrator waits until all 10 queued players are connected before moving them', async () => {
  const calls: Array<{ type: string; payload: Record<string, string | undefined> }> = [];
  const orchestrator = new WarmLobbyOrchestrator({
    async createVoiceChannel(payload) {
      calls.push({ type: 'create', payload });
      return { id: `${payload.name}-id` };
    },
    async moveGuildMemberToVoiceChannel(payload) {
      calls.push({ type: 'move', payload });
    },
    async deleteChannel(channelId) {
      calls.push({ type: 'delete', payload: { channelId } });
    },
  });

  const queued = await orchestrator.queueMatch(createQueuedMatchPayload(), ['1', '2', '3']);
  assert.equal(queued, false);
  assert.equal(calls.length, 0);

  const started = await orchestrator.handleWarmLobbyUpdate(
    'guild-1',
    'warm-1',
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  );

  assert.deepEqual(started, ['match-1']);
  assert.equal(calls.filter((call) => call.type === 'create').length, 2);
  assert.equal(calls.filter((call) => call.type === 'move').length, 10);
  assert.deepEqual(orchestrator.getActiveMatch('match-1')?.teamChannelIds, [
    'Match 1 - Team A-id',
    'Match 1 - Team B-id',
  ]);
});

test('WarmLobbyOrchestrator cleanup moves connected players back to warm lobby and deletes match channels', async () => {
  const moves: Array<{ userId: string; channelId: string }> = [];
  const deletes: string[] = [];
  const orchestrator = new WarmLobbyOrchestrator({
    async createVoiceChannel(payload) {
      return { id: `${payload.name}-id` };
    },
    async moveGuildMemberToVoiceChannel(payload) {
      moves.push({ userId: payload.userId, channelId: payload.channelId });
    },
    async deleteChannel(channelId) {
      deletes.push(channelId);
    },
  });

  await orchestrator.queueMatch(createQueuedMatchPayload(), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  moves.length = 0;

  const cleanedUp = await orchestrator.finishMatch(createFinishedMatchPayload(), ['1', '2', '8']);

  assert.equal(cleanedUp, true);
  assert.deepEqual(moves, [
    { userId: '1', channelId: 'warm-1' },
    { userId: '2', channelId: 'warm-1' },
    { userId: '8', channelId: 'warm-1' },
  ]);
  assert.deepEqual(deletes, ['Match 1 - Team A-id', 'Match 1 - Team B-id']);
  assert.equal(orchestrator.getActiveMatch('match-1'), undefined);
});

test('WarmLobbyOrchestrator rejects queue payloads without 10 distinct players', async () => {
  const orchestrator = new WarmLobbyOrchestrator({
    async createVoiceChannel() {
      return { id: 'voice-1' };
    },
    async moveGuildMemberToVoiceChannel() {
      return;
    },
    async deleteChannel() {
      return;
    },
  });

  const payload = createQueuedMatchPayload();
  payload.teams[1].userIds = ['5', '6', '7', '8', '9'];

  await assert.rejects(() => orchestrator.queueMatch(payload), /10 distinct connected players/);
});

test('WarmLobbyOrchestrator removes pending matches when cleanup arrives before warm lobby is full', async () => {
  const orchestrator = new WarmLobbyOrchestrator({
    async createVoiceChannel() {
      return { id: 'voice-1' };
    },
    async moveGuildMemberToVoiceChannel() {
      return;
    },
    async deleteChannel() {
      return;
    },
  });

  await orchestrator.queueMatch(createQueuedMatchPayload(), ['1', '2', '3']);

  const cleanedUp = await orchestrator.finishMatch(createFinishedMatchPayload());
  const started = await orchestrator.handleWarmLobbyUpdate(
    'guild-1',
    'warm-1',
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  );

  assert.equal(cleanedUp, true);
  assert.deepEqual(started, []);
});
