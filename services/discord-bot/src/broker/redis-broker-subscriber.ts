import { createClient, type RedisClientType } from 'redis';

type RedisClientFactory = (url: string) => RedisClientType;

export class RedisBrokerSubscriber {
  private client: RedisClientType | null = null;

  public constructor(
    private readonly redisUrl: string,
    private readonly channel = 'discord.jobs',
    private readonly redisClientFactory: RedisClientFactory = (url) => createClient({ url }),
  ) {}

  public async start(onMessage: (message: string) => void): Promise<void> {
    if (this.client) {
      return;
    }

    const client = this.redisClientFactory(this.redisUrl);
    this.client = client;
    await client.connect();
    await client.subscribe(this.channel, onMessage);
  }

  public async stop(): Promise<void> {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.client = null;
    await client.unsubscribe(this.channel);
    await client.quit();
  }
}
