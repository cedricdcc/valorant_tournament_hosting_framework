import { Injectable } from '@nestjs/common';
import type { ITournamentStrategy } from './tournament-strategy.interface.js';
import type { RankedTournamentTeam, TeamTiebreakers, TournamentMatch, TournamentPairing, TournamentTeam } from './tournament.types.js';

@Injectable()
export class SwissTournamentStrategy implements ITournamentStrategy {
  readonly format = 'swiss';

  rankTeams(teams: TournamentTeam[], matches: TournamentMatch[]): RankedTournamentTeam[] {
    const tiebreakers = this.calculateTiebreakers(teams, matches);

    return teams
      .filter((team) => team.active)
      .map((team) => ({
        ...team,
        buchholz: tiebreakers[team.id]?.buchholz ?? 0,
        sonnebornBerger: tiebreakers[team.id]?.sonnebornBerger ?? 0,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }

        if (b.buchholz !== a.buchholz) {
          return b.buchholz - a.buchholz;
        }

        if (b.sonnebornBerger !== a.sonnebornBerger) {
          return b.sonnebornBerger - a.sonnebornBerger;
        }

        return a.id.localeCompare(b.id);
      });
  }

  generatePairings(teams: TournamentTeam[], matches: TournamentMatch[]): TournamentPairing[] {
    const rankedTeams = this.rankTeams(teams, matches);
    const grouped = this.groupByPoints(rankedTeams);
    const previousMatchups = this.createPreviousMatchupSet(matches);

    const pairings: TournamentPairing[] = [];
    let carryDown: RankedTournamentTeam[] = [];

    for (const bracket of grouped) {
      const currentBracket = [...carryDown, ...bracket];

      if (currentBracket.length === 0) {
        carryDown = [];
        continue;
      }

      if (currentBracket.length % 2 === 1) {
        carryDown = [currentBracket.pop() as RankedTournamentTeam];
      } else {
        carryDown = [];
      }

      if (currentBracket.length === 0) {
        continue;
      }

      const half = currentBracket.length / 2;
      const upperHalf = currentBracket.slice(0, half);
      const lowerHalf = currentBracket.slice(half);

      const bracketPairings = this.backtrackBracket(upperHalf, lowerHalf, previousMatchups);
      if (!bracketPairings) {
        throw new Error('Unable to generate Swiss pairings without rematches.');
      }

      pairings.push(...bracketPairings);
    }

    if (carryDown.length === 1) {
      pairings.push({ teamAId: carryDown[0].id, teamBId: null });
    }

    return pairings;
  }

  calculateTiebreakers(teams: TournamentTeam[], matches: TournamentMatch[]): Record<string, TeamTiebreakers> {
    const teamPoints = new Map(teams.map((team) => [team.id, team.points]));
    const tiebreakers = new Map<string, TeamTiebreakers>();

    for (const team of teams) {
      tiebreakers.set(team.id, { buchholz: 0, sonnebornBerger: 0 });
    }

    for (const match of matches) {
      const teamAPoints = teamPoints.get(match.teamAId) ?? 0;
      const teamBPoints = teamPoints.get(match.teamBId) ?? 0;

      const aStats = tiebreakers.get(match.teamAId);
      const bStats = tiebreakers.get(match.teamBId);
      if (!aStats || !bStats) {
        continue;
      }

      aStats.buchholz += teamBPoints;
      bStats.buchholz += teamAPoints;

      if (match.winnerId === match.teamAId) {
        aStats.sonnebornBerger += teamBPoints;
      } else if (match.winnerId === match.teamBId) {
        bStats.sonnebornBerger += teamAPoints;
      } else if (match.winnerId === null) {
        aStats.sonnebornBerger += teamBPoints / 2;
        bStats.sonnebornBerger += teamAPoints / 2;
      }
    }

    return Object.fromEntries(tiebreakers.entries());
  }

  private groupByPoints(teams: RankedTournamentTeam[]): RankedTournamentTeam[][] {
    const groups = new Map<number, RankedTournamentTeam[]>();

    for (const team of teams) {
      const existing = groups.get(team.points) ?? [];
      existing.push(team);
      groups.set(team.points, existing);
    }

    return [...groups.entries()]
      .sort(([pointsA], [pointsB]) => pointsB - pointsA)
      .map(([, bracketTeams]) => bracketTeams);
  }

  private createPreviousMatchupSet(matches: TournamentMatch[]): Set<string> {
    const matchups = new Set<string>();

    for (const match of matches) {
      matchups.add(this.matchupKey(match.teamAId, match.teamBId));
    }

    return matchups;
  }

  private matchupKey(teamAId: string, teamBId: string): string {
    return [teamAId, teamBId].sort().join('::');
  }

  private backtrackBracket(
    upperHalf: RankedTournamentTeam[],
    lowerHalf: RankedTournamentTeam[],
    previousMatchups: Set<string>,
  ): TournamentPairing[] | null {
    const used = new Array(lowerHalf.length).fill(false);
    const selectedLowerByUpperIndex = new Array<number>(upperHalf.length).fill(-1);

    const assign = (upperIndex: number): boolean => {
      if (upperIndex === upperHalf.length) {
        return true;
      }

      const preferred = upperIndex;
      const candidateOrder = [preferred, ...lowerHalf.map((_, index) => index).filter((index) => index !== preferred)];

      for (const lowerIndex of candidateOrder) {
        if (used[lowerIndex]) {
          continue;
        }

        const upper = upperHalf[upperIndex];
        const lower = lowerHalf[lowerIndex];
        const hasPlayed = previousMatchups.has(this.matchupKey(upper.id, lower.id));

        if (hasPlayed) {
          continue;
        }

        used[lowerIndex] = true;
        selectedLowerByUpperIndex[upperIndex] = lowerIndex;

        if (assign(upperIndex + 1)) {
          return true;
        }

        used[lowerIndex] = false;
        selectedLowerByUpperIndex[upperIndex] = -1;
      }

      return false;
    };

    if (!assign(0)) {
      return null;
    }

    return upperHalf.map((upper, upperIndex) => ({
      teamAId: upper.id,
      teamBId: lowerHalf[selectedLowerByUpperIndex[upperIndex]].id,
    }));
  }
}
