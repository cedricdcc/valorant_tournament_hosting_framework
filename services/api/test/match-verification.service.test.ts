import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MatchVerificationService,
  type MatchVerificationRepository,
  type PendingTournamentMatch,
  type RiotMatchClient,
  type TournamentAdvancementEngine,
} from '../src/tournament/match-verification.service.js';
import type { RiotMatch } from '../src/tournament/riot-match.types.js';

class MatchVerificationRepositoryMock implements MatchVerificationRepository {
  constructor(public pendingMatches: PendingTournamentMatch[]) {}

  public savedResults: Array<{
    tournamentMatchId: string;
    riotMatchId: string;
    winnerTeamId: string;
    loserTeamId: string;
    winnerScore: number;
    loserScore: number;
    scoreline: string;
  }> = [];

  async listPendingMatchesForVerification(): Promise<PendingTournamentMatch[]> {
    return this.pendingMatches;
  }

  async saveVerifiedMatchResult(result: {
    tournamentMatchId: string;
    riotMatchId: string;
    winnerTeamId: string;
    loserTeamId: string;
    winnerScore: number;
    loserScore: number;
    scoreline: string;
  }): Promise<void> {
    this.savedResults.push(result);
  }
}

class RiotMatchClientMock implements RiotMatchClient {
  constructor(
    private readonly matchlistsByPuuid: Record<string, string[]>,
    private readonly matchesById: Record<string, RiotMatch>,
  ) {}

  async getMatchlistByPuuid(puuid: string): Promise<string[]> {
    return this.matchlistsByPuuid[puuid] ?? [];
  }

  async getMatch(matchId: string) {
    const match = this.matchesById[matchId];
    if (!match) {
      throw new Error(`Unknown matchId ${matchId}`);
    }

    return match;
  }
}

class TournamentAdvancementEngineMock implements TournamentAdvancementEngine {
  public calls: Array<{ tournamentId: string; winnerTeamId: string; sourceMatchId: string }> = [];

  async advanceWinner(tournamentId: string, winnerTeamId: string, sourceMatchId: string): Promise<void> {
    this.calls.push({ tournamentId, winnerTeamId, sourceMatchId });
  }
}

test('pollPendingMatches verifies Riot custom match and advances winner', async () => {
  const repository = new MatchVerificationRepositoryMock([
    {
      id: 'match-db-1',
      tournamentId: 'tournament-1',
      registeredPlayers: [
        { puuid: 'p1', teamId: 'team-a' },
        { puuid: 'p2', teamId: 'team-a' },
        { puuid: 'p3', teamId: 'team-b' },
        { puuid: 'p4', teamId: 'team-b' },
      ],
    },
  ]);

  const riotClient = new RiotMatchClientMock(
    {
      p1: ['old-match', 'target-match'],
      p2: ['target-match'],
      p3: ['target-match'],
      p4: ['another-match'],
    },
    {
      'old-match': {
        matchInfo: { matchId: 'old-match', isTournamentMode: false },
        teams: [
          { teamId: 'Blue', won: true, roundsWon: 13 },
          { teamId: 'Red', won: false, roundsWon: 5 },
        ],
        players: [{ puuid: 'p1', teamId: 'Blue' }],
      },
      'target-match': {
        matchInfo: { matchId: 'target-match', isTournamentMode: true },
        teams: [
          { teamId: 'Blue', won: true, roundsWon: 13 },
          { teamId: 'Red', won: false, roundsWon: 9 },
        ],
        players: [
          { puuid: 'p1', teamId: 'Blue' },
          { puuid: 'p2', teamId: 'Blue' },
          { puuid: 'p3', teamId: 'Red' },
          { puuid: 'p4', teamId: 'Red' },
        ],
      },
      'another-match': {
        matchInfo: { matchId: 'another-match', isTournamentMode: false },
        teams: [
          { teamId: 'Blue', won: true, roundsWon: 13 },
          { teamId: 'Red', won: false, roundsWon: 8 },
        ],
        players: [{ puuid: 'p4', teamId: 'Blue' }],
      },
    },
  );
  const advancementEngine = new TournamentAdvancementEngineMock();

  const service = new MatchVerificationService(repository, riotClient, advancementEngine);
  const result = await service.pollPendingMatches();

  assert.deepEqual(result, { checked: 1, verified: 1 });
  assert.deepEqual(repository.savedResults, [
    {
      tournamentMatchId: 'match-db-1',
      riotMatchId: 'target-match',
      winnerTeamId: 'team-a',
      loserTeamId: 'team-b',
      winnerScore: 13,
      loserScore: 9,
      scoreline: '13-9',
    },
  ]);
  assert.deepEqual(advancementEngine.calls, [
    {
      tournamentId: 'tournament-1',
      winnerTeamId: 'team-a',
      sourceMatchId: 'match-db-1',
    },
  ]);
});

test('pollPendingMatches leaves pending match unchanged when no candidate match validates', async () => {
  const repository = new MatchVerificationRepositoryMock([
    {
      id: 'match-db-2',
      tournamentId: 'tournament-2',
      registeredPlayers: [{ puuid: 'p10', teamId: 'team-x' }],
    },
  ]);

  const riotClient = new RiotMatchClientMock({ p10: [] }, {});
  const advancementEngine = new TournamentAdvancementEngineMock();

  const service = new MatchVerificationService(repository, riotClient, advancementEngine);
  const result = await service.pollPendingMatches();

  assert.deepEqual(result, { checked: 1, verified: 0 });
  assert.equal(repository.savedResults.length, 0);
  assert.equal(advancementEngine.calls.length, 0);
});
