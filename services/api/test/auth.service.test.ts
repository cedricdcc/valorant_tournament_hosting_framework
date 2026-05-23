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

test('buildDiscordBotInviteUrl generates bot invite URL with required scopes and permissions', () => {
  const usersRepository = new UsersRepositoryMock();
  const service = new AuthService(usersRepository as unknown as UsersRepository, async () => {
    throw new Error('HTTP should not be called in this test');
  }, baseEnv);

  const inviteUrl = service.buildDiscordBotInviteUrl();
  const parsed = new URL(inviteUrl);

  assert.equal(parsed.origin + parsed.pathname, 'https://discord.com/oauth2/authorize');
  assert.equal(parsed.searchParams.get('client_id'), baseEnv.DISCORD_CLIENT_ID);
  assert.equal(parsed.searchParams.get('scope'), 'bot applications.commands');
  assert.equal(parsed.searchParams.get('permissions'), '16777232');
});

test('getDiscordBotOnboarding returns explicit admin onboarding steps', () => {
  const usersRepository = new UsersRepositoryMock();
  const service = new AuthService(usersRepository as unknown as UsersRepository, async () => {
    throw new Error('HTTP should not be called in this test');
  }, baseEnv);

  const onboarding = service.getDiscordBotOnboarding();

  assert.equal(onboarding.requiredPermissionInteger, '16777232');
  assert.deepEqual(onboarding.requiredScopes, ['bot', 'applications.commands']);
  assert.equal(onboarding.steps.length, 3);
  assert.deepEqual(onboarding.steps, [
    {
      title: 'Step 1: Invite the Bot',
      instruction:
        "Click here to authorize the Valorant Tournament Bot for your server. You must have the 'Manage Server' or 'Administrator' permission in Discord to do this.",
    },
    {
      title: 'Step 2: Role Hierarchy Setup',
      instruction:
        "Crucial Setup Step: Open your Discord Server Settings -> Roles. You must drag the new 'Tournament Bot' role high up in your role list. It must be placed above any user roles it needs to manage, otherwise, Discord's hierarchy rules will block the bot from moving players or creating channels.",
    },
    {
      title: "Step 3: 'Warm Lobby' Configuration",
      instruction:
        "The bot cannot force offline players into a voice channel. Please designate or create a public voice channel to act as the 'Warm Lobby'. Players must connect here before their match so the bot can automatically move them to their isolated team channels.",
    },
  ]);
});

test('getDiscordBotOnboardingHtml renders onboarding wizard with invite link and steps', () => {
  const usersRepository = new UsersRepositoryMock();
  const service = new AuthService(usersRepository as unknown as UsersRepository, async () => {
    throw new Error('HTTP should not be called in this test');
  }, baseEnv);

  const html = service.getDiscordBotOnboardingHtml();

  assert.match(html, /<h1>Valorant Tournament Bot Server Onboarding<\/h1>/);
  assert.match(html, /client_id=discord-client-id/);
  assert.match(html, /scope=bot\+applications\.commands/);
  assert.match(html, /permissions=16777232/);
  assert.match(html, /Step 1: Invite the Bot/);
  assert.match(html, /Step 2: Role Hierarchy Setup/);
  assert.match(html, /Step 3: &#39;Warm Lobby&#39; Configuration/);
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
