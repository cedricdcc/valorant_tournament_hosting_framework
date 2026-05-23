import test from 'node:test';
import assert from 'node:assert/strict';
import { getConnectedVoiceUserIds, parseBrokerMessage } from '../src/listeners/broker-message-listener.js';

test('parseBrokerMessage accepts broker payload with absolute API path', () => {
  const payload = parseBrokerMessage(
    JSON.stringify({
      endpoint: '/guilds/123/channels',
      method: 'POST',
      body: { name: 'match-1' },
    }),
  );

  assert.equal(payload.endpoint, '/guilds/123/channels');
  assert.equal(payload.method, 'POST');
});

test('parseBrokerMessage rejects payloads without an absolute path endpoint', () => {
  assert.throws(() => parseBrokerMessage(JSON.stringify({ endpoint: 'guilds/123/channels' })), /absolute Discord API path/);
});

test('parseBrokerMessage accepts queue-match warm lobby payloads', () => {
  const payload = parseBrokerMessage(
    JSON.stringify({
      type: 'queue-match-voice',
      guildId: 'guild-1',
      matchId: 'match-1',
      warmLobbyChannelId: 'warm-1',
      teams: [
        { teamId: 'team-a', channelName: 'Match 1 - Team A', userIds: ['1', '2', '3', '4', '5'] },
        { teamId: 'team-b', channelName: 'Match 1 - Team B', userIds: ['6', '7', '8', '9', '10'] },
      ],
    }),
  );

  assert.equal(payload.type, 'queue-match-voice');
});

test('parseBrokerMessage accepts cleanup warm lobby payloads', () => {
  const payload = parseBrokerMessage(
    JSON.stringify({
      type: 'cleanup-match-voice',
      guildId: 'guild-1',
      matchId: 'match-1',
    }),
  );

  assert.equal(payload.type, 'cleanup-match-voice');
});

test('getConnectedVoiceUserIds returns member snowflakes from a voice channel', () => {
  const memberIds = getConnectedVoiceUserIds({
    members: new Map([
      ['1', {}],
      ['2', {}],
    ]),
  });

  assert.deepEqual(memberIds, ['1', '2']);
});
