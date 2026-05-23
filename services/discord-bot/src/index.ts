import { TournamentBotClient } from './bot-client.js';
import { RedisBrokerSubscriber } from './broker/redis-broker-subscriber.js';
import { requireEnv } from './discord-api-client.js';

const botToken = requireEnv('DISCORD_BOT_TOKEN');
const redisUrl = requireEnv('REDIS_URL');
const brokerChannel = process.env.DISCORD_BROKER_CHANNEL?.trim() || 'discord.jobs';

const client = new TournamentBotClient({
  plugins: [
    (bot) => {
      bot.once('ready', () => {
        console.log(`Discord bot ready as ${bot.user?.tag ?? 'unknown-user'}`);
      });
    },
  ],
});

const brokerSubscriber = new RedisBrokerSubscriber(redisUrl, brokerChannel);
await brokerSubscriber.start((message) => {
  client.emit('brokerMessage', message);
});

const shutdown = async () => {
  await brokerSubscriber.stop();
  client.destroy();
};

process.once('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.once('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

await client.login(botToken);
