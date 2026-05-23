import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrokerMessage } from '../src/listeners/broker-message-listener.js';

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
