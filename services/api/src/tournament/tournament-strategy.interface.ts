import type { RankedTournamentTeam, TeamTiebreakers, TournamentMatch, TournamentPairing, TournamentTeam } from './tournament.types.js';

export interface ITournamentStrategy {
  readonly format: string;
  rankTeams(teams: TournamentTeam[], matches: TournamentMatch[]): RankedTournamentTeam[];
  generatePairings(teams: TournamentTeam[], matches: TournamentMatch[]): TournamentPairing[];
  calculateTiebreakers(teams: TournamentTeam[], matches: TournamentMatch[]): Record<string, TeamTiebreakers>;
}
