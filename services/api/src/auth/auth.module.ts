import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { QueueOptions } from 'bullmq';
import { Pool } from 'pg';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UsersRepository } from './users.repository.js';
import {
  DISCORD_GATEWAY_CLIENT,
  DISCORD_ORCHESTRATION_QUEUE,
  type DiscordGatewayClient,
  type MoveUsersJobData,
} from '../discord/discord-orchestration.constants.js';
import { DiscordOrchestrationProcessor } from '../discord/discord-orchestration.processor.js';
import { DiscordOrchestrationService } from '../discord/discord-orchestration.service.js';
import { LegalController } from '../legal/legal.controller.js';
import { LegalService } from '../legal/legal.service.js';

function getNumberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createBullRootOptions(): { connection: QueueOptions['connection'] } {
  return {
    connection: {
      host: process.env.REDIS_HOST ?? 'redis',
      port: getNumberFromEnv(process.env.REDIS_PORT, 6379),
      ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
      ...(process.env.REDIS_DB ? { db: getNumberFromEnv(process.env.REDIS_DB, 0) } : {}),
    },
  };
}

function createDiscordQueueOptions() {
  return {
    name: DISCORD_ORCHESTRATION_QUEUE,
    limiter: {
      max: getNumberFromEnv(process.env.DISCORD_MOVE_TOKENS_PER_WINDOW, 10),
      duration: getNumberFromEnv(process.env.DISCORD_MOVE_TOKEN_WINDOW_MS, 1000),
    },
    defaultJobOptions: {
      attempts: getNumberFromEnv(process.env.DISCORD_MOVE_RETRY_ATTEMPTS, 5),
      backoff: {
        type: 'exponential' as const,
        delay: getNumberFromEnv(process.env.DISCORD_MOVE_RETRY_DELAY_MS, 1000),
      },
      removeOnComplete: true,
    },
  };
}

class NoopDiscordGatewayClient implements DiscordGatewayClient {
  async moveUsersToVoiceChannel(_payload: MoveUsersJobData): Promise<void> {
    return;
  }
}

@Module({
  imports: [BullModule.forRoot(createBullRootOptions()), BullModule.registerQueue(createDiscordQueueOptions())],
  controllers: [AuthController, LegalController],
  providers: [
    {
      provide: DISCORD_GATEWAY_CLIENT,
      useClass: NoopDiscordGatewayClient,
    },
    DiscordOrchestrationProcessor,
    DiscordOrchestrationService,
    {
      provide: Pool,
      useFactory: () => new Pool({ connectionString: process.env.DATABASE_URL }),
    },
    {
      provide: UsersRepository,
      useFactory: (pool: Pool) => new UsersRepository(pool),
      inject: [Pool],
    },
    {
      provide: AuthService,
      useFactory: (usersRepository: UsersRepository) => new AuthService(usersRepository),
      inject: [UsersRepository],
    },
    LegalService,
  ],
  exports: [DiscordOrchestrationService],
})
export class AuthModule {}
