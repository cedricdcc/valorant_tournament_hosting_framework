import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTournamentMatchResult } from '../src/tournament/riot-match.parser.js';
import type { RiotMatch } from '../src/tournament/riot-match.types.js';

test('parseTournamentMatchResult validates tournament mode, scoreline, and team mapping', () => {
  const riotMatch: RiotMatch = {
    matchInfo: {
      matchId: 'riot-match-1',
      isTournamentMode: true,
    },
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
  };

  const result = parseTournamentMatchResult(riotMatch, [
    { puuid: 'p1', teamId: 'team-alpha' },
    { puuid: 'p2', teamId: 'team-alpha' },
    { puuid: 'p3', teamId: 'team-bravo' },
    { puuid: 'p4', teamId: 'team-bravo' },
  ]);

  assert.deepEqual(result, {
    riotMatchId: 'riot-match-1',
    winnerTeamId: 'team-alpha',
    loserTeamId: 'team-bravo',
    winnerScore: 13,
    loserScore: 9,
    scoreline: '13-9',
  });
});

test('parseTournamentMatchResult rejects non-tournament matches', () => {
  const riotMatch: RiotMatch = {
    matchInfo: {
      matchId: 'riot-match-2',
      isTournamentMode: false,
    },
    teams: [
      { teamId: 'Blue', won: true, roundsWon: 13 },
      { teamId: 'Red', won: false, roundsWon: 10 },
    ],
    players: [
      { puuid: 'p1', teamId: 'Blue' },
      { puuid: 'p2', teamId: 'Red' },
    ],
  };

  assert.throws(() => parseTournamentMatchResult(riotMatch, []), /not a tournament mode custom lobby/);
});
