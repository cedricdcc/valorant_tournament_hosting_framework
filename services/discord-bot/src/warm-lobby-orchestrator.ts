import type {
  CreateVoiceChannelRequest,
  CreatedVoiceChannel,
  MoveGuildMemberRequest,
} from './discord-api-client.js';

export interface MatchVoiceTeam {
  teamId: string;
  channelName: string;
  userIds: string[];
}

export interface QueueMatchVoicePayload {
  type: 'queue-match-voice';
  guildId: string;
  matchId: string;
  warmLobbyChannelId: string;
  categoryId?: string;
  teams: [MatchVoiceTeam, MatchVoiceTeam];
}

export interface CleanupMatchVoicePayload {
  type: 'cleanup-match-voice';
  guildId: string;
  matchId: string;
}

export interface ActiveMatchVoiceState {
  guildId: string;
  matchId: string;
  warmLobbyChannelId: string;
  participantUserIds: string[];
  teamChannelIds: string[];
}

interface DiscordVoiceApi {
  createVoiceChannel(request: CreateVoiceChannelRequest): Promise<CreatedVoiceChannel>;
  moveGuildMemberToVoiceChannel(request: MoveGuildMemberRequest): Promise<void>;
  deleteChannel(channelId: string): Promise<void>;
}

function getParticipantUserIds(payload: QueueMatchVoicePayload): string[] {
  return payload.teams.flatMap((team) => team.userIds);
}

function validateQueuedMatch(payload: QueueMatchVoicePayload): void {
  const participantUserIds = getParticipantUserIds(payload);
  const uniqueUserIds = new Set(participantUserIds);

  if (payload.teams.length !== 2) {
    throw new Error('Warm lobby orchestration requires exactly two teams');
  }

  if (participantUserIds.length !== 10 || uniqueUserIds.size !== 10) {
    throw new Error('Warm lobby orchestration requires exactly 10 distinct connected players');
  }
}

export class WarmLobbyOrchestrator {
  private readonly pendingMatches = new Map<string, QueueMatchVoicePayload>();
  private readonly activeMatches = new Map<string, ActiveMatchVoiceState>();

  public constructor(private readonly discordApiClient: DiscordVoiceApi) {}

  public async queueMatch(
    payload: QueueMatchVoicePayload,
    connectedWarmLobbyUserIds: readonly string[] = [],
  ): Promise<boolean> {
    validateQueuedMatch(payload);
    this.pendingMatches.set(payload.matchId, payload);
    return this.tryStartMatch(payload, connectedWarmLobbyUserIds);
  }

  public async handleWarmLobbyUpdate(
    guildId: string,
    warmLobbyChannelId: string,
    connectedWarmLobbyUserIds: readonly string[],
  ): Promise<string[]> {
    const startedMatchIds: string[] = [];

    for (const pendingMatch of this.pendingMatches.values()) {
      if (pendingMatch.guildId !== guildId || pendingMatch.warmLobbyChannelId !== warmLobbyChannelId) {
        continue;
      }

      if (await this.tryStartMatch(pendingMatch, connectedWarmLobbyUserIds)) {
        startedMatchIds.push(pendingMatch.matchId);
      }
    }

    return startedMatchIds;
  }

  public async finishMatch(
    payload: CleanupMatchVoicePayload,
    connectedMatchUserIds: readonly string[] = [],
  ): Promise<boolean> {
    const activeMatch = this.activeMatches.get(payload.matchId);
    const pendingMatch = this.pendingMatches.get(payload.matchId);
    if (!activeMatch || activeMatch.guildId !== payload.guildId) {
      if (pendingMatch && pendingMatch.guildId === payload.guildId) {
        this.pendingMatches.delete(payload.matchId);
        return true;
      }

      return false;
    }

    const connectedParticipants = activeMatch.participantUserIds.filter((userId) => connectedMatchUserIds.includes(userId));
    for (const userId of connectedParticipants) {
      await this.discordApiClient.moveGuildMemberToVoiceChannel({
        guildId: activeMatch.guildId,
        userId,
        channelId: activeMatch.warmLobbyChannelId,
      });
    }

    for (const channelId of activeMatch.teamChannelIds) {
      await this.discordApiClient.deleteChannel(channelId);
    }

    this.activeMatches.delete(payload.matchId);
    return true;
  }

  public getActiveMatch(matchId: string): ActiveMatchVoiceState | undefined {
    return this.activeMatches.get(matchId);
  }

  private async tryStartMatch(
    payload: QueueMatchVoicePayload,
    connectedWarmLobbyUserIds: readonly string[],
  ): Promise<boolean> {
    if (!this.pendingMatches.has(payload.matchId) || this.activeMatches.has(payload.matchId)) {
      return false;
    }

    const participantUserIds = getParticipantUserIds(payload);
    if (!participantUserIds.every((userId) => connectedWarmLobbyUserIds.includes(userId))) {
      return false;
    }

    const teamChannels: string[] = [];
    for (const team of payload.teams) {
      const channel = await this.discordApiClient.createVoiceChannel({
        guildId: payload.guildId,
        name: team.channelName,
        parentId: payload.categoryId,
      });
      teamChannels.push(channel.id);
    }

    for (let teamIndex = 0; teamIndex < payload.teams.length; teamIndex += 1) {
      const team = payload.teams[teamIndex];
      const targetChannelId = teamChannels[teamIndex];
      for (const userId of team.userIds) {
        await this.discordApiClient.moveGuildMemberToVoiceChannel({
          guildId: payload.guildId,
          userId,
          channelId: targetChannelId,
        });
      }
    }

    this.pendingMatches.delete(payload.matchId);
    this.activeMatches.set(payload.matchId, {
      guildId: payload.guildId,
      matchId: payload.matchId,
      warmLobbyChannelId: payload.warmLobbyChannelId,
      participantUserIds,
      teamChannelIds: teamChannels,
    });

    return true;
  }
}
