import type { MatchEvent } from "../live-score/match-event-store";
import type { Match } from "../matches/match-store";
import type { Player } from "../players/player-store";
import type { Team } from "../teams/team-store";

export type PlayerStatsSource = {
  events: MatchEvent[];
  matches: Match[];
  players: Player[];
  teams: Team[];
};

export type PlayerStatRow = {
  fouls: number;
  onePointMakes: number;
  player: Player;
  pointActions: number;
  rank: number;
  team: Team;
  totalPoints: number;
  twoPointMakes: number;
  twoPointPoints: number;
};

type MutablePlayerStatRow = Omit<PlayerStatRow, "rank">;

export function getTopScorers(
  tournamentId: string,
  source: PlayerStatsSource,
) {
  return getRankedRows(tournamentId, source, "totalPoints");
}

export function getTopTwoPointShooters(
  tournamentId: string,
  source: PlayerStatsSource,
) {
  return getRankedRows(tournamentId, source, "twoPointMakes");
}

export function getTopOnePointScorers(
  tournamentId: string,
  source: PlayerStatsSource,
) {
  return getRankedRows(tournamentId, source, "onePointMakes");
}

export function getMostActivePlayers(
  tournamentId: string,
  source: PlayerStatsSource,
) {
  return getRankedRows(tournamentId, source, "pointActions");
}

export function getTopFoulPlayers(
  tournamentId: string,
  source: PlayerStatsSource,
) {
  return getRankedRows(tournamentId, source, "fouls");
}

function getRankedRows(
  tournamentId: string,
  source: PlayerStatsSource,
  sortKey: keyof Pick<
    PlayerStatRow,
    | "fouls"
    | "onePointMakes"
    | "pointActions"
    | "totalPoints"
    | "twoPointMakes"
  >,
) {
  return calculatePlayerStats(tournamentId, source)
    .filter((row) => row[sortKey] > 0)
    .sort((a, b) => compareRows(a, b, sortKey))
    .slice(0, 5)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function calculatePlayerStats(
  tournamentId: string,
  { events, matches, players, teams }: PlayerStatsSource,
) {
  const tournamentMatches = new Map(
    matches
      .filter(
        (match) =>
          match.tournamentId === tournamentId &&
          (match.status === "FINISHED" || match.status === "LIVE"),
      )
      .map((match) => [match.id, match]),
  );
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const rowsByPlayerId = new Map<string, MutablePlayerStatRow>();

  for (const event of events) {
    if (event.isDeleted === true || !event.playerId) {
      continue;
    }

    const match = tournamentMatches.get(event.matchId);

    if (!match) {
      continue;
    }

    if (event.type !== "POINT" && event.type !== "FOUL") {
      continue;
    }

    const player = playerMap.get(event.playerId);
    const team = player ? teamMap.get(player.teamId) : undefined;

    if (!player || !team || team.tournamentId !== tournamentId) {
      continue;
    }

    const row = getOrCreateRow(rowsByPlayerId, player, team);

    if (event.type === "POINT") {
      row.pointActions += 1;
      row.totalPoints += event.points ?? 0;

      if (event.points === 2) {
        row.twoPointMakes += 1;
        row.twoPointPoints += 2;
      }

      if (event.points === 1) {
        row.onePointMakes += 1;
      }
    }

    if (event.type === "FOUL") {
      row.fouls += 1;
    }
  }

  return [...rowsByPlayerId.values()].map((row) => ({
    ...row,
    rank: 0,
  }));
}

function getOrCreateRow(
  rowsByPlayerId: Map<string, MutablePlayerStatRow>,
  player: Player,
  team: Team,
) {
  const existingRow = rowsByPlayerId.get(player.id);

  if (existingRow) {
    return existingRow;
  }

  const row: MutablePlayerStatRow = {
    fouls: 0,
    onePointMakes: 0,
    player,
    pointActions: 0,
    team,
    totalPoints: 0,
    twoPointMakes: 0,
    twoPointPoints: 0,
  };

  rowsByPlayerId.set(player.id, row);

  return row;
}

function compareRows(
  a: PlayerStatRow,
  b: PlayerStatRow,
  sortKey: keyof Pick<
    PlayerStatRow,
    | "fouls"
    | "onePointMakes"
    | "pointActions"
    | "totalPoints"
    | "twoPointMakes"
  >,
) {
  return (
    b[sortKey] - a[sortKey] ||
    b.totalPoints - a.totalPoints ||
    b.twoPointMakes - a.twoPointMakes ||
    a.player.lastName.localeCompare(b.player.lastName) ||
    a.player.firstName.localeCompare(b.player.firstName)
  );
}
