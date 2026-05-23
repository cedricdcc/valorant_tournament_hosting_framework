import type { RiotMatch } from './riot-match.types.js';

export interface RegisteredTournamentPlayer {
  puuid: string;
  teamId: string;
}

export interface ParsedTournamentMatchResult {
  riotMatchId: string;
  winnerTeamId: string;
  loserTeamId: string;
  winnerScore: number;
  loserScore: number;
  scoreline: string;
}

function isTournamentModeEnabled(match: RiotMatch): boolean {
  if (match.tournamentMode === true) {
    return true;
  }

  if (typeof match.tournamentMode === 'string' && match.tournamentMode.toLowerCase() === 'tournament') {
    return true;
  }

  if (match.matchInfo?.isTournamentMode === true) {
    return true;
  }

  return Boolean(match.matchInfo?.tournamentId);
}

function getRoundsWon(roundsWon: number | undefined): number {
  return Number.isFinite(roundsWon) ? (roundsWon as number) : 0;
}

function getMappedTeamId(
  riotTeamId: string,
  riotMatch: RiotMatch,
  registrationByPuuid: Map<string, string>,
): string {
  const teamVoteCounts = new Map<string, number>();

  for (const player of riotMatch.players ?? []) {
    if (player.teamId !== riotTeamId || !player.puuid) {
      continue;
    }

    const registeredTeamId = registrationByPuuid.get(player.puuid);
    if (!registeredTeamId) {
      continue;
    }

    teamVoteCounts.set(registeredTeamId, (teamVoteCounts.get(registeredTeamId) ?? 0) + 1);
  }

  const orderedVotes = [...teamVoteCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topVote = orderedVotes[0];
  if (!topVote) {
    throw new Error(`Unable to map Riot team ${riotTeamId} to a registered tournament team`);
  }

  const tiedForFirst = orderedVotes.length > 1 && orderedVotes[1][1] === topVote[1];
  if (tiedForFirst) {
    throw new Error(`Ambiguous player mapping for Riot team ${riotTeamId}`);
  }

  return topVote[0];
}

export function parseTournamentMatchResult(
  riotMatch: RiotMatch,
  registeredPlayers: RegisteredTournamentPlayer[],
): ParsedTournamentMatchResult {
  if (!isTournamentModeEnabled(riotMatch)) {
    throw new Error('Match is not a tournament mode custom lobby');
  }

  const riotMatchId = riotMatch.matchInfo?.matchId;
  if (!riotMatchId) {
    throw new Error('Riot match payload missing matchInfo.matchId');
  }

  const teams = riotMatch.teams ?? [];
  if (teams.length < 2) {
    throw new Error('Riot match payload missing team score data');
  }

  const winnerRiotTeam =
    teams.find((team) => team.won === true && team.teamId) ??
    [...teams].sort((a, b) => getRoundsWon(b.roundsWon) - getRoundsWon(a.roundsWon))[0];
  if (!winnerRiotTeam?.teamId) {
    throw new Error('Unable to determine winner team from Riot match data');
  }

  const loserRiotTeam = teams.find((team) => team.teamId && team.teamId !== winnerRiotTeam.teamId);
  if (!loserRiotTeam?.teamId) {
    throw new Error('Unable to determine loser team from Riot match data');
  }

  const registrationByPuuid = new Map(registeredPlayers.map((player) => [player.puuid, player.teamId]));
  const winnerTeamId = getMappedTeamId(winnerRiotTeam.teamId, riotMatch, registrationByPuuid);
  const loserTeamId = getMappedTeamId(loserRiotTeam.teamId, riotMatch, registrationByPuuid);

  if (winnerTeamId === loserTeamId) {
    throw new Error('Riot team mapping resolved to the same tournament team');
  }

  const winnerScore = getRoundsWon(winnerRiotTeam.roundsWon);
  const loserScore = getRoundsWon(loserRiotTeam.roundsWon);

  return {
    riotMatchId,
    winnerTeamId,
    loserTeamId,
    winnerScore,
    loserScore,
    scoreline: `${winnerScore}-${loserScore}`,
  };
}
