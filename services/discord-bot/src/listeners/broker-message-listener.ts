import { Listener } from '@sapphire/framework';
import { getDiscordApiClient, getWarmLobbyOrchestrator } from '../warm-lobby-runtime.js';
import type {
  CleanupMatchVoicePayload,
  QueueMatchVoicePayload,
} from '../warm-lobby-orchestrator.js';

type DiscordApiRequestBrokerMessage = {
  endpoint: string;
  method?: string;
  body?: unknown;
};

export type BrokerMessagePayload =
  | DiscordApiRequestBrokerMessage
  | QueueMatchVoicePayload
  | CleanupMatchVoicePayload;

export function getConnectedVoiceUserIds(
  channel:
    | {
        members?: {
          keys(): IterableIterator<string>;
        };
      }
    | null
    | undefined,
): string[] {
  if (!channel?.members) {
    return [];
  }

  return Array.from(channel.members.keys());
}

export function parseBrokerMessage(rawMessage: string): BrokerMessagePayload {
  const payload = JSON.parse(rawMessage) as Partial<BrokerMessagePayload>;

  if (payload.type === 'queue-match-voice') {
    if (!payload.guildId || !payload.matchId || !payload.warmLobbyChannelId || !payload.teams) {
      throw new Error('Queue match voice payload must include guild, match, warm lobby, and team assignments');
    }

    return payload as QueueMatchVoicePayload;
  }

  if (payload.type === 'cleanup-match-voice') {
    if (!payload.guildId || !payload.matchId) {
      throw new Error('Cleanup match voice payload must include guild and match identifiers');
    }

    return payload as CleanupMatchVoicePayload;
  }

  if (!payload.endpoint || !payload.endpoint.startsWith('/')) {
    throw new Error('Broker payload endpoint must be an absolute Discord API path');
  }

  return payload as DiscordApiRequestBrokerMessage;
}

export class BrokerMessageListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options = {}) {
    super(context, {
      ...options,
      event: 'brokerMessage',
    });
  }

  public async run(rawMessage: string): Promise<void> {
    const payload = parseBrokerMessage(rawMessage);

    if ('endpoint' in payload) {
      await getDiscordApiClient().request(payload.endpoint, {
        method: payload.method ?? 'POST',
        body: payload.body === undefined ? undefined : JSON.stringify(payload.body),
        headers: payload.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      });
      return;
    }

    const orchestrator = getWarmLobbyOrchestrator();
    if (payload.type === 'queue-match-voice') {
      const warmLobbyChannel = this.container.client.channels.cache.get(payload.warmLobbyChannelId);
      await orchestrator.queueMatch(payload, getConnectedVoiceUserIds(warmLobbyChannel));
      return;
    }

    const activeMatch = orchestrator.getActiveMatch(payload.matchId);
    const connectedUserIds = activeMatch
      ? activeMatch.teamChannelIds.flatMap((channelId) =>
          getConnectedVoiceUserIds(this.container.client.channels.cache.get(channelId)),
        )
      : [];

    await orchestrator.finishMatch(payload, connectedUserIds);
  }
}

declare module 'discord.js' {
  interface ClientEvents {
    brokerMessage: [message: string];
  }
}
