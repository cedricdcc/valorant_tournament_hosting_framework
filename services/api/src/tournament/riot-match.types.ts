export interface RiotMatchlistEntry {
  matchId: string;
}

export interface RiotMatchlistResponse {
  history?: RiotMatchlistEntry[];
}

export interface RiotMatchInfo {
  matchId?: string;
  isTournamentMode?: boolean;
  tournamentId?: string | null;
  queueId?: string;
  gameMode?: string;
}

export interface RiotMatchTeam {
  teamId?: string;
  won?: boolean;
  roundsWon?: number | null;
}

export interface RiotMatchPlayer {
  puuid?: string;
  teamId?: string;
}

export interface RiotMatch {
  matchInfo?: RiotMatchInfo;
  tournamentMode?: boolean | string;
  teams?: RiotMatchTeam[];
  players?: RiotMatchPlayer[];
}
