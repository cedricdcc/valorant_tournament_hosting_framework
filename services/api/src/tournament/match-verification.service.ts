import { Injectable } from '@nestjs/common';
import { parseTournamentMatchResult, type RegisteredTournamentPlayer } from './riot-match.parser.js';
import type { RiotMatch } from './riot-match.types.js';

export interface PendingTournamentMatch {
  id: string;
  tournamentId: string;
  riotMatchId?: string | null;
  registeredPlayers: RegisteredTournamentPlayer[];
}

export interface MatchVerificationRepository {
  listPendingMatchesForVerification(): Promise<PendingTournamentMatch[]>;
  saveVerifiedMatchResult(result: {
    tournamentMatchId: string;
    riotMatchId: string;
    winnerTeamId: string;
    loserTeamId: string;
    winnerScore: number;
    loserScore: number;
    scoreline: string;
  }): Promise<void>;
}

export interface RiotMatchClient {
  getMatchlistByPuuid(puuid: string): Promise<string[]>;
  getMatch(matchId: string): Promise<RiotMatch>;
}

export interface TournamentAdvancementEngine {
  advanceWinner(tournamentId: string, winnerTeamId: string, sourceMatchId: string): Promise<void>;
}

@Injectable()
export class MatchVerificationService {
  constructor(
    private readonly repository: MatchVerificationRepository,
    private readonly riotMatchClient: RiotMatchClient,
    private readonly tournamentAdvancementEngine: TournamentAdvancementEngine,
  ) {}

  async pollPendingMatches(): Promise<{ checked: number; verified: number }> {
    const pendingMatches = await this.repository.listPendingMatchesForVerification();
    let verified = 0;

    for (const pendingMatch of pendingMatches) {
      if (await this.verifyPendingMatch(pendingMatch)) {
        verified += 1;
      }
    }

    return { checked: pendingMatches.length, verified };
  }

  private async verifyPendingMatch(pendingMatch: PendingTournamentMatch): Promise<boolean> {
    const candidateMatchIds = await this.getCandidateMatchIds(pendingMatch);
    if (candidateMatchIds.length === 0) {
      return false;
    }

    for (const candidateMatchId of candidateMatchIds) {
      const riotMatch = await this.riotMatchClient.getMatch(candidateMatchId);

      try {
        const parsedResult = parseTournamentMatchResult(riotMatch, pendingMatch.registeredPlayers);

        await this.repository.saveVerifiedMatchResult({
          tournamentMatchId: pendingMatch.id,
          riotMatchId: parsedResult.riotMatchId,
          winnerTeamId: parsedResult.winnerTeamId,
          loserTeamId: parsedResult.loserTeamId,
          winnerScore: parsedResult.winnerScore,
          loserScore: parsedResult.loserScore,
          scoreline: parsedResult.scoreline,
        });

        await this.tournamentAdvancementEngine.advanceWinner(
          pendingMatch.tournamentId,
          parsedResult.winnerTeamId,
          pendingMatch.id,
        );

        return true;
      } catch {
        continue;
      }
    }

    return false;
  }

  private async getCandidateMatchIds(pendingMatch: PendingTournamentMatch): Promise<string[]> {
    const candidateCounts = new Map<string, number>();

    if (pendingMatch.riotMatchId) {
      candidateCounts.set(pendingMatch.riotMatchId, Number.MAX_SAFE_INTEGER);
    }

    const puuids = [...new Set(pendingMatch.registeredPlayers.map((player) => player.puuid))];
    for (const puuid of puuids) {
      const matchIds = await this.riotMatchClient.getMatchlistByPuuid(puuid);
      for (const matchId of matchIds) {
        candidateCounts.set(matchId, (candidateCounts.get(matchId) ?? 0) + 1);
      }
    }

    return [...candidateCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([matchId]) => matchId);
  }
}
