import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import {
  DISCORD_MOVE_USERS_JOB,
  DISCORD_ORCHESTRATION_QUEUE,
  type MoveUsersJobData,
} from './discord-orchestration.constants.js';

@Injectable()
export class DiscordOrchestrationService {
  constructor(
    @InjectQueue(DISCORD_ORCHESTRATION_QUEUE)
    private readonly queue: Queue<MoveUsersJobData>,
  ) {}

  enqueueMoveUsersTask(payload: MoveUsersJobData): Promise<Job<MoveUsersJobData>> {
    return this.queue.add(DISCORD_MOVE_USERS_JOB, payload);
  }
}
