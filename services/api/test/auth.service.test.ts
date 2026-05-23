import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/auth/auth.service.js';
import { createSignedStateToken } from '../src/auth/state-token.js';
import type { UsersRepository } from '../src/auth/users.repository.js';

type QueryArgs = Parameters<UsersRepository['upsertLinkedIdentity']>[0];

class UsersRepositoryMock {
  public received: QueryArgs | null = null;

  async upsertLinkedIdentity(input: QueryArgs) {
    this.received = input;
    return {
      id: 'user-1',
      discord_snowflake: input.discordSnowflake,
      discord_username: input.discordUsername,
      riot_puuid: input.riotPuuid,
      riot_game_name: input.riotGameName,
      riot_tag_line: input.riotTagLine,
      privacy_opt_in: input.privacyOptIn,
    };
  }
}

const baseEnv = {
  RIOT_RSO_CLIENT_ID: 'riot-client-id',
  RIOT_RSO_CLIENT_SECRET: 'riot-secret',
  RIOT_RSO_REDIRECT_URI: 'https://api.example.com/auth/riot/callback',
  DISCORD_CLIENT_ID: 'discord-client-id',
  DISCORD_CLIENT_SECRET: 'discord-secret',
  DISCORD_REDIRECT_URI: 'https://api.example.com/auth/discord/callback',
  AUTH_LINK_SECRET: 'super-secret-link-signing-key',
};

test('buildRiotAuthorizeUrl generates the expected redirect url and scope', () => {
  const usersRepository = new UsersRepositoryMock();
  const service = new AuthService(usersRepository as unknown as UsersRepository, async () => {
    throw new Error('HTTP should not be called in this test');
  }, baseEnv);

  const linkToken = createSignedStateToken(
    {
      discordSnowflake: '123',
      discordUsername: 'discord-user',
      privacyOptIn: true,
      nonce: 'nonce-1',
    },
    baseEnv.AUTH_LINK_SECRET,
    600,
  );

  const redirectUrl = service.buildRiotAuthorizeUrl(linkToken);
  const parsed = new URL(redirectUrl);

  assert.equal(parsed.origin + parsed.pathname, 'https://auth.riotgames.com/authorize');
  assert.equal(parsed.searchParams.get('client_id'), baseEnv.RIOT_RSO_CLIENT_ID);
  assert.equal(parsed.searchParams.get('redirect_uri'), baseEnv.RIOT_RSO_REDIRECT_URI);
  assert.equal(parsed.searchParams.get('response_type'), 'code');
  assert.equal(parsed.searchParams.get('scope'), 'openid offline_access');
  assert.equal(parsed.searchParams.get('state'), linkToken);
});

test('handleRiotCallback exchanges token, fetches account me, and persists merged identity', async () => {
  const usersRepository = new UsersRepositoryMock();
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const service = new AuthService(
    usersRepository as unknown as UsersRepository,
    async (url, init) => {
      calls.push({ url, init });

      if (url === 'https://auth.riotgames.com/token') {
        return {
          ok: true,
          status: 200,
          async json() {
            return { access_token: 'riot-access-token' };
          },
          async text() {
            return '';
          },
        };
      }

      if (url === 'https://americas.api.riotgames.com/riot/account/v1/accounts/me') {
        assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer riot-access-token');

        return {
          ok: true,
          status: 200,
          async json() {
            return {
              puuid: 'encrypted-puuid',
              gameName: 'PlayerName',
              tagLine: 'NA1',
            };
          },
          async text() {
            return '';
          },
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
    baseEnv,
  );

  const state = createSignedStateToken(
    {
      discordSnowflake: '987654321',
      discordUsername: 'discord-user#1234',
      privacyOptIn: true,
      nonce: 'nonce-2',
    },
    baseEnv.AUTH_LINK_SECRET,
    600,
  );

  const result = await service.handleRiotCallback('riot-auth-code', state);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://auth.riotgames.com/token');
  assert.equal((calls[0].init?.method ?? '').toUpperCase(), 'POST');

  const tokenBody = calls[0].init?.body;
  assert.equal(typeof tokenBody, 'string');
  assert.match(tokenBody as string, /grant_type=authorization_code/);
  assert.match(tokenBody as string, /code=riot-auth-code/);

  assert.deepEqual(result.riotProfile, {
    puuid: 'encrypted-puuid',
    gameName: 'PlayerName',
    tagLine: 'NA1',
  });

  assert.deepEqual(usersRepository.received, {
    discordSnowflake: '987654321',
    discordUsername: 'discord-user#1234',
    riotPuuid: 'encrypted-puuid',
    riotGameName: 'PlayerName',
    riotTagLine: 'NA1',
    privacyOptIn: true,
  });
});
