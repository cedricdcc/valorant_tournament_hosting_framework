export const DISCORD_ORCHESTRATION_QUEUE = 'discord-orchestration';
export const DISCORD_MOVE_USERS_JOB = 'move-users';
export const DISCORD_GATEWAY_CLIENT = Symbol('DISCORD_GATEWAY_CLIENT');

export interface MoveUsersJobData {
  guildId: string;
  targetChannelId: string;
  userIds: string[];
}

export interface DiscordGatewayClient {
  moveUsersToVoiceChannel(payload: MoveUsersJobData): Promise<void>;
}
