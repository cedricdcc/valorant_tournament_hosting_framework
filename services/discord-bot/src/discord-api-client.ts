const DEFAULT_DISCORD_USER_AGENT =
  'valorant_tournament_hosting_framework-discord-bot/0.1.0 (+https://github.com/cedricdcc/valorant_tournament_hosting_framework)';
const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';

export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function assertValidUserAgent(userAgent: string): void {
  if (!/^[^\s/]+\/[^\s]+/.test(userAgent)) {
    throw new Error('DISCORD_USER_AGENT must be a valid Product/Version user-agent string');
  }
}

export class DiscordApiClient {
  public constructor(
    private readonly token: string,
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    assertValidUserAgent(this.userAgent);
  }

  public async request(path: string, init: RequestInit = {}): Promise<Response> {
    if (!path.startsWith('/')) {
      throw new Error('Discord API path must start with "/"');
    }

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bot ${this.token}`);
    headers.set('User-Agent', this.userAgent);

    return this.fetchImpl(`${DISCORD_API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  }
}

export function createDiscordApiClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): DiscordApiClient {
  const token = requireEnv('DISCORD_BOT_TOKEN', env);
  const userAgent = env.DISCORD_USER_AGENT?.trim() || DEFAULT_DISCORD_USER_AGENT;

  return new DiscordApiClient(token, userAgent, fetchImpl);
}
