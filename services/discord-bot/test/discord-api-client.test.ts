import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscordApiClientFromEnv } from '../src/discord-api-client.js';

test('createDiscordApiClientFromEnv sends Authorization and User-Agent headers', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const client = createDiscordApiClientFromEnv(
    {
      DISCORD_BOT_TOKEN: 'secure-token',
      DISCORD_USER_AGENT: 'valorant-bot/1.0.0',
    },
    async (url, init) => {
      calls.push({ url, init });
      return new Response('{}', { status: 200 });
    },
  );

  await client.request('/channels/123/messages', {
    method: 'POST',
    body: JSON.stringify({ content: 'hello' }),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://discord.com/api/v10/channels/123/messages');
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get('Authorization'), 'Bot secure-token');
  assert.equal(headers.get('User-Agent'), 'valorant-bot/1.0.0');
});

test('createDiscordApiClientFromEnv rejects missing token', () => {
  assert.throws(() => createDiscordApiClientFromEnv({}), /DISCORD_BOT_TOKEN/);
});

test('createDiscordApiClientFromEnv rejects invalid user-agent format', () => {
  assert.throws(
    () =>
      createDiscordApiClientFromEnv({
        DISCORD_BOT_TOKEN: 'secure-token',
        DISCORD_USER_AGENT: 'invalid user agent',
      }),
    /user-agent string/,
  );
});
