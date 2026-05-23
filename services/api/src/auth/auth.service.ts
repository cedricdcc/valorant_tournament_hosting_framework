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

export const RIOT_LEGAL_BOILERPLATE =
  "Valorant Tournament Hosting Framework isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

const RIOT_LEGAL_FOOTER_HTML = `<footer style="background:#12151c;border-top:1px solid #2e3140;padding:1rem 2rem;text-align:center;font-size:0.75rem;color:#6b7280;line-height:1.6;">
  ${escapeHtml(RIOT_LEGAL_BOILERPLATE)}
</footer>`;

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
  ${RIOT_LEGAL_FOOTER_HTML}
</body>
</html>`;
  }

  getRegistrationHtml(): string {
    const discordAuthorizeWithOptIn = `/auth/discord/authorize?privacyOptIn=true`;

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Player Registration &mdash; Valorant Tournament</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 0; background: #0f1116; color: #e5e5e5; display: flex; flex-direction: column; min-height: 100vh; }
    main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .card { background: #1a1d24; border: 1px solid #2e3140; border-radius: 12px; padding: 2.5rem 2rem; max-width: 480px; width: 100%; }
    h1 { margin: 0 0 0.5rem; font-size: 1.75rem; color: #ff4655; }
    .subtitle { margin: 0 0 2rem; color: #9ca3af; font-size: 0.95rem; }
    .btn { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.75rem 1.25rem; border-radius: 8px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; text-decoration: none; margin-bottom: 1rem; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.88; }
    .btn-discord { background: #5865f2; color: #fff; }
    .btn-riot { background: #ff4655; color: #fff; }
    .btn svg { width: 22px; height: 22px; flex-shrink: 0; }
    .divider { text-align: center; color: #4b5563; margin: 0.5rem 0 1.25rem; font-size: 0.85rem; }
    .privacy-box { background: #12151c; border: 1px solid #2e3140; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem; font-size: 0.875rem; color: #9ca3af; line-height: 1.6; }
    .privacy-box strong { color: #e5e5e5; }
    .opt-in-row { display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 1.5rem; }
    .opt-in-row input[type="checkbox"] { width: 18px; height: 18px; margin-top: 2px; accent-color: #ff4655; flex-shrink: 0; cursor: pointer; }
    .opt-in-row label { font-size: 0.875rem; color: #9ca3af; cursor: pointer; line-height: 1.5; }
    .opt-in-row label a { color: #ff4655; }
    #register-btn { display: none; }
    #register-btn.visible { display: flex; }
    footer { background: #12151c; border-top: 1px solid #2e3140; padding: 1.25rem 2rem; text-align: center; font-size: 0.75rem; color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <main>
    <div class="card">
      <h1>Player Registration</h1>
      <p class="subtitle">Link your Discord and Riot accounts to compete in tournaments.</p>

      <div class="privacy-box" role="note" aria-label="Privacy disclosure">
        <strong>Data Disclosure &amp; Privacy Notice</strong><br>
        By registering, you agree that your <strong>player stats</strong>, <strong>gameplay data</strong>, and
        <strong>Riot ID</strong> (game name + tag) will be made <strong>publicly visible</strong> within the
        context of this tournament platform. Your Discord username will also be displayed on brackets and
        team rosters. This data is used solely for tournament administration and will not be sold to third
        parties. You may withdraw consent at any time by contacting the tournament organizer.<br><br>
        See our <a href="/legal/privacy">Privacy Policy</a> and <a href="/legal/terms">Terms of Service</a>
        for full details.
      </div>

      <form id="opt-in-form">
        <div class="opt-in-row">
          <input
            type="checkbox"
            id="privacy-opt-in"
            name="privacyOptIn"
            required
            aria-required="true"
            aria-describedby="opt-in-label"
          >
          <label id="opt-in-label" for="privacy-opt-in">
            I have read and agree to the data disclosure above. I consent to my player stats, gameplay
            data, and Riot ID being publicly visible within this tournament. I confirm I am at least 16
            years old (or have parental consent where required).
          </label>
        </div>
      </form>

      <p class="divider">Step 1 &mdash; log in with Discord, then link your Riot account</p>

      <a id="register-btn" class="btn btn-discord" href="${escapeHtml(discordAuthorizeWithOptIn)}" aria-label="Log in with Discord">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
        Log in with Discord
      </a>

      <p class="divider">Step 2 &mdash; after Discord login you will be redirected to Riot</p>

      <a class="btn btn-riot" href="#" aria-label="Log in with Riot Games (RSO)" aria-disabled="true" tabindex="-1" style="opacity:0.5;pointer-events:none;" id="riot-btn">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.534 21.77 2 19.502v-15l10.534-2.27 9.466 2.24v15.06zm-1.08-13.906-4.922-.678-.031 6.825 1.564.107.024-2.413 1.314.09c1.47.1 2.572-.695 2.603-2.108.03-1.287-.848-1.712-2.552-1.823zm-.285 2.559-1.377-.094.028-1.522 1.318.088c.56.038.94.243.926.73-.015.494-.387.833-.895.798zm7.254-3.278h-1.546v6.028h1.546zm-3.75 0h-1.535v6.028h1.535z"/></svg>
        Log in with Riot Games (RSO)
      </a>
    </div>
  </main>
  ${RIOT_LEGAL_FOOTER_HTML}
  <script>
    (function () {
      var checkbox = document.getElementById('privacy-opt-in');
      var registerBtn = document.getElementById('register-btn');
      var riotBtn = document.getElementById('riot-btn');
      function toggle() {
        if (checkbox.checked) {
          registerBtn.classList.add('visible');
          riotBtn.style.opacity = '0.5';
          riotBtn.style.pointerEvents = 'none';
        } else {
          registerBtn.classList.remove('visible');
        }
      }
      checkbox.addEventListener('change', toggle);
    })();
  </script>
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
