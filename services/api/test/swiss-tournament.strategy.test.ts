import test from 'node:test';
import assert from 'node:assert/strict';
import { SwissTournamentStrategy } from '../src/tournament/swiss-tournament.strategy.js';
import type { TournamentMatch, TournamentTeam } from '../src/tournament/tournament.types.js';

test('rankTeams sorts active teams by points then Buchholz then Sonneborn-Berger', () => {
  const strategy = new SwissTournamentStrategy();

  const teams: TournamentTeam[] = [
    { id: 'A', points: 6, active: true },
    { id: 'B', points: 6, active: true },
    { id: 'C', points: 3, active: true },
    { id: 'D', points: 0, active: false },
  ];

  const matches: TournamentMatch[] = [
    { teamAId: 'A', teamBId: 'C', winnerId: 'A' },
    { teamAId: 'B', teamBId: 'C', winnerId: 'B' },
  ];

  const ranked = strategy.rankTeams(teams, matches);

  assert.deepEqual(
    ranked.map((team) => team.id),
    ['A', 'B', 'C'],
  );
  assert.equal(ranked[0].points, 6);
  assert.equal(ranked[0].buchholz, 3);
  assert.equal(ranked[0].sonnebornBerger, 3);
});

test('generatePairings splits each score bracket and pairs top-down', () => {
  const strategy = new SwissTournamentStrategy();

  const teams: TournamentTeam[] = [
    { id: 'A', points: 6, active: true },
    { id: 'B', points: 6, active: true },
    { id: 'C', points: 6, active: true },
    { id: 'D', points: 6, active: true },
  ];

  const pairings = strategy.generatePairings(teams, []);

  assert.deepEqual(pairings, [
    { teamAId: 'A', teamBId: 'C' },
    { teamAId: 'B', teamBId: 'D' },
  ]);
});

test('generatePairings uses backtracking to avoid rematches', () => {
  const strategy = new SwissTournamentStrategy();

  const teams: TournamentTeam[] = [
    { id: 'A', points: 3, active: true },
    { id: 'B', points: 3, active: true },
    { id: 'C', points: 3, active: true },
    { id: 'D', points: 3, active: true },
  ];

  const matches: TournamentMatch[] = [
    { teamAId: 'A', teamBId: 'C', winnerId: 'A' },
    { teamAId: 'B', teamBId: 'D', winnerId: 'B' },
  ];

  const pairings = strategy.generatePairings(teams, matches);

  assert.deepEqual(pairings, [
    { teamAId: 'A', teamBId: 'D' },
    { teamAId: 'B', teamBId: 'C' },
  ]);
});

test('calculateTiebreakers returns Buchholz and Sonneborn-Berger scores', () => {
  const strategy = new SwissTournamentStrategy();

  const teams: TournamentTeam[] = [
    { id: 'A', points: 7, active: true },
    { id: 'B', points: 4, active: true },
    { id: 'C', points: 1, active: true },
  ];

  const matches: TournamentMatch[] = [
    { teamAId: 'A', teamBId: 'B', winnerId: 'A' },
    { teamAId: 'A', teamBId: 'C', winnerId: null },
    { teamAId: 'B', teamBId: 'C', winnerId: 'B' },
  ];

  const tiebreakers = strategy.calculateTiebreakers(teams, matches);

  assert.deepEqual(tiebreakers.A, { buchholz: 5, sonnebornBerger: 4.5 });
  assert.deepEqual(tiebreakers.B, { buchholz: 8, sonnebornBerger: 1 });
  assert.deepEqual(tiebreakers.C, { buchholz: 11, sonnebornBerger: 3.5 });
});
