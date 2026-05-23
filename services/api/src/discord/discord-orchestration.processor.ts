import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import {
  DISCORD_GATEWAY_CLIENT,
  DISCORD_MOVE_USERS_JOB,
  DISCORD_ORCHESTRATION_QUEUE,
  type DiscordGatewayClient,
  type MoveUsersJobData,
} from './discord-orchestration.constants.js';

const DEFAULT_RETRY_AFTER_MS = 1000;

interface Discord429Error {
  status?: number;
  retryAfterMs?: number;
  response?: {
    status?: number;
    headers?: Record<string, string | undefined>;
  };
}

@Processor(DISCORD_ORCHESTRATION_QUEUE)
export class DiscordOrchestrationProcessor extends WorkerHost {
  constructor(
    @Inject(DISCORD_GATEWAY_CLIENT)
    private readonly discordGatewayClient: DiscordGatewayClient,
  ) {
    super();
  }

  async process(job: Job<MoveUsersJobData>): Promise<void> {
    if (job.name !== DISCORD_MOVE_USERS_JOB) {
      return;
    }

    try {
      await this.discordGatewayClient.moveUsersToVoiceChannel(job.data);
    } catch (error) {
      const retryAfterMs = this.getRateLimitRetryAfter(error as Discord429Error);
      if (retryAfterMs === null) {
        throw error;
      }

      await this.applyRateLimit(retryAfterMs);
      throw Worker.RateLimitError();
    }
  }

  protected async applyRateLimit(retryAfterMs: number): Promise<void> {
    if (this.worker) {
      await this.worker.rateLimit(retryAfterMs);
    }
  }

  private getRateLimitRetryAfter(error: Discord429Error): number | null {
    const status = error.status ?? error.response?.status;
    if (status !== 429) {
      return null;
    }

    const retryAfterHeader = error.response?.headers?.['retry-after'];
    const retryAfterSeconds = retryAfterHeader ? Number.parseFloat(retryAfterHeader) : Number.NaN;
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.ceil(retryAfterSeconds * 1000);
    }

    if (typeof error.retryAfterMs === 'number' && error.retryAfterMs > 0) {
      return Math.ceil(error.retryAfterMs);
    }

    return DEFAULT_RETRY_AFTER_MS;
  }
}
