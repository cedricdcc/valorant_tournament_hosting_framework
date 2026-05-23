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

test('DiscordApiClient creates voice channels and moves members with Discord voice endpoints', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const client = createDiscordApiClientFromEnv(
    {
      DISCORD_BOT_TOKEN: 'secure-token',
      DISCORD_USER_AGENT: 'valorant-bot/1.0.0',
    },
    async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: 'voice-1' }), { status: 200 });
    },
  );

  const createdChannel = await client.createVoiceChannel({
    guildId: 'guild-1',
    name: 'Match 1 - Team A',
    parentId: 'category-1',
  });
  await client.moveGuildMemberToVoiceChannel({
    guildId: 'guild-1',
    userId: 'user-1',
    channelId: createdChannel.id,
  });
  await client.deleteChannel(createdChannel.id);

  assert.equal(createdChannel.id, 'voice-1');
  assert.equal(calls[0]?.url, 'https://discord.com/api/v10/guilds/guild-1/channels');
  assert.equal(calls[1]?.url, 'https://discord.com/api/v10/guilds/guild-1/members/user-1');
  assert.equal(calls[2]?.url, 'https://discord.com/api/v10/channels/voice-1');

  const createBody = JSON.parse(String(calls[0]?.init?.body));
  assert.deepEqual(createBody, {
    name: 'Match 1 - Team A',
    parent_id: 'category-1',
    type: 2,
  });

  const moveBody = JSON.parse(String(calls[1]?.init?.body));
  assert.deepEqual(moveBody, { channel_id: 'voice-1' });
  assert.equal(calls[2]?.init?.method, 'DELETE');
});
