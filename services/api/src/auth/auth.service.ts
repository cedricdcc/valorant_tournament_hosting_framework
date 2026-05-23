import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createSignedStateToken, verifySignedStateToken } from './state-token.js';
import { UsersRepository, type UserRecord } from './users.repository.js';

type HttpResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

type HttpClient = (url: string, init?: RequestInit) => Promise<HttpResponse>;

interface RiotCallbackState {
  discordSnowflake: string;
  discordUsername: string;
  privacyOptIn: boolean;
  nonce: string;
  exp: number;
  iat: number;
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator?: string;
}

interface RiotMeResponse {
  puuid?: string;
  gameName?: string;
  tagLine?: string;
}

interface AuthConfig {
  riotRsoClientId: string;
  riotRsoClientSecret: string;
  riotRedirectUri: string;
  riotAuthorizeEndpoint: string;
  riotTokenEndpoint: string;
  riotAccountApiBaseUrl: string;
  discordClientId: string;
  discordClientSecret: string;
  discordRedirectUri: string;
  discordAuthorizeEndpoint: string;
  discordTokenEndpoint: string;
  discordApiBaseUrl: string;
  authLinkSecret: string;
}

function requireConfig(name: keyof AuthConfig, env: NodeJS.ProcessEnv, fallback?: string): string {
  const value = env[name as string] ?? fallback;
  if (!value) {
    throw new Error(`Missing required configuration: ${name}`);
  }

  return value;
}

export interface LinkedIdentityResult {
  riotProfile: {
    puuid: string;
    gameName: string;
    tagLine: string;
  };
  user: UserRecord;
}

const DISCORD_BOT_OAUTH_SCOPES = ['bot', 'applications.commands'] as const;
const DISCORD_MANAGE_CHANNELS_PERMISSION = 16n;
const DISCORD_MOVE_MEMBERS_PERMISSION = 16777216n;
const DISCORD_BOT_PERMISSION_INTEGER = (DISCORD_MANAGE_CHANNELS_PERMISSION | DISCORD_MOVE_MEMBERS_PERMISSION).toString();

export interface DiscordBotOnboardingStep {
  title: string;
  instruction: string;
}

export interface DiscordBotOnboardingPayload {
  inviteUrl: string;
  requiredScopes: readonly string[];
  requiredPermissionInteger: string;
  steps: readonly DiscordBotOnboardingStep[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

@Injectable()
export class AuthService {
  private readonly config: AuthConfig;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly httpClient: HttpClient = fetch as HttpClient,
    env: NodeJS.ProcessEnv = process.env,
  ) {
    this.config = {
      riotRsoClientId: requireConfig('riotRsoClientId', env, env.RIOT_RSO_CLIENT_ID),
      riotRsoClientSecret: requireConfig('riotRsoClientSecret', env, env.RIOT_RSO_CLIENT_SECRET),
      riotRedirectUri: requireConfig('riotRedirectUri', env, env.RIOT_RSO_REDIRECT_URI),
      riotAuthorizeEndpoint: requireConfig('riotAuthorizeEndpoint', env, 'https://auth.riotgames.com/authorize'),
      riotTokenEndpoint: requireConfig('riotTokenEndpoint', env, 'https://auth.riotgames.com/token'),
      riotAccountApiBaseUrl: requireConfig('riotAccountApiBaseUrl', env, 'https://americas.api.riotgames.com'),
      discordClientId: requireConfig('discordClientId', env, env.DISCORD_CLIENT_ID),
      discordClientSecret: requireConfig('discordClientSecret', env, env.DISCORD_CLIENT_SECRET),
      discordRedirectUri: requireConfig('discordRedirectUri', env, env.DISCORD_REDIRECT_URI),
      discordAuthorizeEndpoint: requireConfig('discordAuthorizeEndpoint', env, 'https://discord.com/oauth2/authorize'),
      discordTokenEndpoint: requireConfig('discordTokenEndpoint', env, 'https://discord.com/api/oauth2/token'),
      discordApiBaseUrl: requireConfig('discordApiBaseUrl', env, 'https://discord.com/api'),
      authLinkSecret: requireConfig('authLinkSecret', env, env.AUTH_LINK_SECRET),
    };
  }

  buildDiscordAuthorizeUrl(privacyOptIn: boolean): string {
    const state = createSignedStateToken({ privacyOptIn }, this.config.authLinkSecret, 600);
    const params = new URLSearchParams({
      client_id: this.config.discordClientId,
      redirect_uri: this.config.discordRedirectUri,
      response_type: 'code',
      scope: 'identify',
      state,
    });

    return `${this.config.discordAuthorizeEndpoint}?${params.toString()}`;
  }

  buildDiscordBotInviteUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.discordClientId,
      scope: DISCORD_BOT_OAUTH_SCOPES.join(' '),
      permissions: DISCORD_BOT_PERMISSION_INTEGER,
    });

    return `${this.config.discordAuthorizeEndpoint}?${params.toString()}`;
  }

  getDiscordBotOnboarding(): DiscordBotOnboardingPayload {
    return {
      inviteUrl: this.buildDiscordBotInviteUrl(),
      requiredScopes: DISCORD_BOT_OAUTH_SCOPES,
      requiredPermissionInteger: DISCORD_BOT_PERMISSION_INTEGER,
      steps: [
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
      ],
    };
  }

  getDiscordBotOnboardingHtml(): string {
    const onboarding = this.getDiscordBotOnboarding();
    const stepsHtml = onboarding.steps
      .map(
        (step) =>
          `<li><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.instruction)}</p></li>`,
      )
      .join('');

    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Discord Bot Onboarding</title></head>
<body>
  <h1>Valorant Tournament Bot Server Onboarding</h1>
  <p><a href="${escapeHtml(onboarding.inviteUrl)}">Click here to authorize the Valorant Tournament Bot for your server.</a></p>
  <ol>${stepsHtml}</ol>
</body>
</html>`;
  }

  async exchangeDiscordCode(code: string, state: string): Promise<string> {
    const verifiedState = verifySignedStateToken<{ privacyOptIn?: boolean }>(state, this.config.authLinkSecret);
    if (verifiedState.privacyOptIn !== true) {
      throw new ForbiddenException('Privacy opt-in is required before linking Riot identity');
    }

    const accessToken = await this.exchangeAuthorizationCode(
      this.config.discordTokenEndpoint,
      {
        client_id: this.config.discordClientId,
        client_secret: this.config.discordClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.discordRedirectUri,
      },
      'Discord',
    );

    const response = await this.httpClient(`${this.config.discordApiBaseUrl}/users/@me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new InternalServerErrorException(`Discord profile fetch failed with status ${response.status}`);
    }

    const discordUser = (await response.json()) as DiscordUser;
    if (!discordUser.id || !discordUser.username) {
      throw new InternalServerErrorException('Discord profile response missing required fields');
    }

    const username = discordUser.discriminator
      ? `${discordUser.username}#${discordUser.discriminator}`
      : discordUser.username;

    return createSignedStateToken(
      {
        discordSnowflake: discordUser.id,
        discordUsername: username,
        privacyOptIn: true,
        nonce: randomUUID(),
      },
      this.config.authLinkSecret,
      600,
    );
  }

  buildRiotAuthorizeUrl(linkToken: string): string {
    const linkState = verifySignedStateToken<RiotCallbackState>(linkToken, this.config.authLinkSecret);
    if (linkState.privacyOptIn !== true) {
      throw new ForbiddenException('Privacy opt-in is required before linking Riot identity');
    }

    const params = new URLSearchParams({
      client_id: this.config.riotRsoClientId,
      redirect_uri: this.config.riotRedirectUri,
      response_type: 'code',
      scope: 'openid offline_access',
      state: linkToken,
    });

    return `${this.config.riotAuthorizeEndpoint}?${params.toString()}`;
  }

  async handleRiotCallback(code: string, state: string): Promise<LinkedIdentityResult> {
    const verifiedState = verifySignedStateToken<RiotCallbackState>(state, this.config.authLinkSecret);
    if (verifiedState.privacyOptIn !== true) {
      throw new ForbiddenException('Privacy opt-in is required before linking Riot identity');
    }

    const riotAccessToken = await this.exchangeAuthorizationCode(
      this.config.riotTokenEndpoint,
      {
        client_id: this.config.riotRsoClientId,
        client_secret: this.config.riotRsoClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.riotRedirectUri,
      },
      'Riot',
    );

    const meResponse = await this.httpClient(`${this.config.riotAccountApiBaseUrl}/riot/account/v1/accounts/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${riotAccessToken}`,
      },
    });

    if (!meResponse.ok) {
      throw new InternalServerErrorException(`Riot account lookup failed with status ${meResponse.status}`);
    }

    const profile = (await meResponse.json()) as RiotMeResponse;
    if (!profile.puuid || !profile.gameName || !profile.tagLine) {
      throw new InternalServerErrorException('Riot account profile missing required fields');
    }

    const user = await this.usersRepository.upsertLinkedIdentity({
      discordSnowflake: verifiedState.discordSnowflake,
      discordUsername: verifiedState.discordUsername,
      riotPuuid: profile.puuid,
      riotGameName: profile.gameName,
      riotTagLine: profile.tagLine,
      privacyOptIn: true,
    });

    return {
      riotProfile: {
        puuid: profile.puuid,
        gameName: profile.gameName,
        tagLine: profile.tagLine,
      },
      user,
    };
  }

  private async exchangeAuthorizationCode(
    tokenEndpoint: string,
    payload: Record<string, string>,
    providerName: string,
  ): Promise<string> {
    const response = await this.httpClient(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(payload).toString(),
    });

    if (!response.ok) {
      const reason = await response.text();
      throw new InternalServerErrorException(`${providerName} token exchange failed: ${reason}`);
    }

    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token) {
      throw new InternalServerErrorException(`${providerName} token exchange response missing access_token`);
    }

    return body.access_token;
  }

  assertAuthorizationCode(code: string | undefined): string {
    if (!code) {
      throw new BadRequestException('Missing authorization code');
    }

    return code;
  }

  assertState(state: string | undefined): string {
    if (!state) {
      throw new BadRequestException('Missing OAuth state');
    }

    return state;
  }
}
