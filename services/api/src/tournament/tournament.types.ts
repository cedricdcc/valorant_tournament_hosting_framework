export interface TournamentTeam {
  id: string;
  points: number;
  active: boolean;
}

export interface TournamentMatch {
  teamAId: string;
  teamBId: string;
  winnerId?: string | null;
}

export interface TournamentPairing {
  teamAId: string;
  teamBId: string | null;
}

export interface TeamTiebreakers {
  buchholz: number;
  sonnebornBerger: number;
}

export interface RankedTournamentTeam extends TournamentTeam, TeamTiebreakers {}
