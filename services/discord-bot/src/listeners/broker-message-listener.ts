import { Listener } from '@sapphire/framework';
import { createDiscordApiClientFromEnv } from '../discord-api-client.js';

type BrokerMessagePayload = {
  endpoint: string;
  method?: string;
  body?: unknown;
};

export function parseBrokerMessage(rawMessage: string): BrokerMessagePayload {
  const payload = JSON.parse(rawMessage) as Partial<BrokerMessagePayload>;

  if (!payload.endpoint || !payload.endpoint.startsWith('/')) {
    throw new Error('Broker payload endpoint must be an absolute Discord API path');
  }

  return payload as BrokerMessagePayload;
}

export class BrokerMessageListener extends Listener {
  private readonly discordApiClient = createDiscordApiClientFromEnv();

  public constructor(context: Listener.LoaderContext, options: Listener.Options = {}) {
    super(context, {
      ...options,
      event: 'brokerMessage',
    });
  }

  public async run(rawMessage: string): Promise<void> {
    const payload = parseBrokerMessage(rawMessage);

    await this.discordApiClient.request(payload.endpoint, {
      method: payload.method ?? 'POST',
      body: payload.body === undefined ? undefined : JSON.stringify(payload.body),
      headers: payload.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }
}

declare module 'discord.js' {
  interface ClientEvents {
    brokerMessage: [message: string];
  }
}
