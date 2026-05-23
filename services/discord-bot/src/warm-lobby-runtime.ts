import { createDiscordApiClientFromEnv, type DiscordApiClient } from './discord-api-client.js';
import { WarmLobbyOrchestrator } from './warm-lobby-orchestrator.js';

let warmLobbyOrchestrator: WarmLobbyOrchestrator | null = null;
let discordApiClient: DiscordApiClient | null = null;

export function getDiscordApiClient(): DiscordApiClient {
  if (!discordApiClient) {
    discordApiClient = createDiscordApiClientFromEnv();
  }

  return discordApiClient;
}

export function getWarmLobbyOrchestrator(): WarmLobbyOrchestrator {
  if (!warmLobbyOrchestrator) {
    warmLobbyOrchestrator = new WarmLobbyOrchestrator(getDiscordApiClient());
  }

  return warmLobbyOrchestrator;
}
