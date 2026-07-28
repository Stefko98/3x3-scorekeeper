import type { MatchEvent } from "../live-score/match-event-store";
import {
  getMatchPhase,
  type Match,
  type MatchPhase,
} from "../matches/match-store";
import type { Player } from "../players/player-store";
import type { Team } from "../teams/team-store";

export type PlayerStatsSource = {
  events: MatchEvent[];
  matches: Match[];
  players: Player[];
  teams: Team[];
};

export type StatsPhaseFilter = "ALL" | "KNOCKOUT" | MatchPhase;

export type PlayerStatsFilter = {
  groupName: string;
  phase: StatsPhaseFilter;
};

export type PlayerStatRow = {
  assists: number;
  assistsPerGame: number;
  fouls: number;
  foulsPerGame: number;
  matchesPlayed: number;
  mvpIndex: number;
  onePointMakes: number;
  player: Player;
  pointActions: number;
  pointsPerGame: number;
  rank: number;
  rebounds: number;
  reboundsPerGame: number;
  team: Team;
  totalPoints: number;
  twoPointMakes: number;
  twoPointPoints: number;
};

export type PlayerMatchStatRow = {
  assists: number;
  fouls: number;
  match: Match;
  onePointMakes: number;
  opponent?: Team;
  phase: MatchPhase;
  points: number;
  rebounds: number;
  result: "POBEDA" | "PORAZ" | "UŽIVO";
  score: string;
  team: Team;
  twoPointMakes: number;
};

export type TeamStatRow = {
  assists: number;
  averagePointsAgainst: number;
  averagePointsFor: number;
  fouls: number;
  losses: number;
  matchesPlayed: number;
  onePointMakes: number;
  pointDifference: number;
  pointsAgainst: number;
  pointsFor: number;
  rebounds: number;
  team: Team;
  twoPointMakes: number;
  wins: number;
};

export type TournamentRecord = {
  context: string;
  holder: string;
  id: string;
  label: string;
  value: string;
};

type MutablePlayerStatRow = Omit<
  PlayerStatRow,
  | "assistsPerGame"
  | "foulsPerGame"
  | "mvpIndex"
  | "pointsPerGame"
  | "rank"
  | "reboundsPerGame"
>;

type InternalPlayerStatRow = MutablePlayerStatRow & {
  matchIds: Set<string>;
};

type PlayerMatchAggregate = {
  assists: number;
  fouls: number;
  match: Match;
  onePointMakes: number;
  player: Player;
  points: number;
  rebounds: number;
  team: Team;
  twoPointMakes: number;
};

const defaultFilter: PlayerStatsFilter = {
  groupName: "ALL",
  phase: "ALL",
};

export function getTopScorers(
  tournamentId: string,
  source: PlayerStatsSource,
  filter: PlayerStatsFilter = defaultFilter,
) {
  return getRankedRows(tournamentId, source, "totalPoints", filter);
}

export function getTopOverallPlayers(
  tournamentId: string,
  source: PlayerStatsSource,
  filter: PlayerStatsFilter = defaultFilter,
) {
  return calculatePlayerStats(tournamentId, source, filter)
    .filter(
      (row) =>
        row.matchesPlayed > 0 &&
        row.totalPoints + row.assists + row.rebounds > 0,
    )
    .sort(compareOverallRows)
    .slice(0, 5)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function getTopTwoPointShooters(
  tournamentId: string,
  source: PlayerStatsSource,
  filter: PlayerStatsFilter = defaultFilter,
) {
  return getRankedRows(tournamentId, source, "twoPointMakes", filter);
}

export function getTopOnePointScorers(
  tournamentId: string,
  source: PlayerStatsSource,
  filter: PlayerStatsFilter = defaultFilter,
) {
  return getRankedRows(tournamentId, source, "onePointMakes", filter);
}

export function getTopFoulPlayers(
  tournamentId: string,
  source: PlayerStatsSource,
  filter: PlayerStatsFilter = defaultFilter,
) {
  return getRankedRows(tournamentId, source, "fouls", filter);
}

export function getTopAssistPlayers(
  tournamentId: string,
  source: PlayerStatsSource,
  filter: PlayerStatsFilter = defaultFilter,
) {
  return getRankedRows(tournamentId, source, "assists", filter);
}

export function getTopReboundPlayers(
  tournamentId: string,
  source: PlayerStatsSource,
  filter: PlayerStatsFilter = defaultFilter,
) {
  return getRankedRows(tournamentId, source, "rebounds", filter);
}

export function calculatePlayerStats(
  tournamentId: string,
  { events, matches, players, teams }: PlayerStatsSource,
  filter: PlayerStatsFilter = defaultFilter,
) {
  const eligibleMatches = getFilteredTournamentMatches(
    tournamentId,
    matches,
    teams,
    filter,
  );
  const tournamentMatches = new Map(
    eligibleMatches.map((match) => [match.id, match]),
  );
  const eligibleTeamIds = new Set(
    eligibleMatches.flatMap((match) => [match.teamAId, match.teamBId]),
  );
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const rowsByPlayerId = new Map<string, InternalPlayerStatRow>();
  const hasNarrowFilter =
    filter.phase !== "ALL" || normalizeFilterGroup(filter.groupName) !== "ALL";

  for (const player of players) {
    const team = teamMap.get(player.teamId);

    if (
      !team ||
      team.tournamentId !== tournamentId ||
      (hasNarrowFilter && !eligibleTeamIds.has(team.id))
    ) {
      continue;
    }

    const row = getOrCreateRow(rowsByPlayerId, player, team);

    for (const match of tournamentMatches.values()) {
      if (match.teamAId === team.id || match.teamBId === team.id) {
        row.matchIds.add(match.id);
      }
    }

    row.matchesPlayed = row.matchIds.size;
  }

  for (const event of events) {
    if (
      event.isDeleted === true ||
      !event.playerId ||
      !isStatEvent(event)
    ) {
      continue;
    }

    const match = tournamentMatches.get(event.matchId);

    if (!match) {
      continue;
    }

    const player = playerMap.get(event.playerId);
    const team = player ? teamMap.get(player.teamId) : undefined;

    if (!player || !team || team.tournamentId !== tournamentId) {
      continue;
    }

    const row = getOrCreateRow(rowsByPlayerId, player, team);
    row.matchIds.add(match.id);
    row.matchesPlayed = row.matchIds.size;
    addEventToPlayerRow(row, event);
  }

  return [...rowsByPlayerId.values()].map(finalizePlayerRow);
}

export function getPlayerMatchStats(
  tournamentId: string,
  playerId: string,
  source: PlayerStatsSource,
  filter: PlayerStatsFilter = defaultFilter,
): PlayerMatchStatRow[] {
  const player = source.players.find((item) => item.id === playerId);
  const team = player
    ? source.teams.find((item) => item.id === player.teamId)
    : undefined;

  if (!player || !team || team.tournamentId !== tournamentId) {
    return [];
  }

  const teamMap = new Map(source.teams.map((item) => [item.id, item]));
  const matches = getFilteredTournamentMatches(
    tournamentId,
    source.matches,
    source.teams,
    filter,
  ).filter((match) => match.teamAId === team.id || match.teamBId === team.id);
  const eventsByMatchId = groupStatEventsByMatch(source.events, playerId);

  return matches
    .map((match) => {
      const events = eventsByMatchId.get(match.id) ?? [];
      const isTeamA = match.teamAId === team.id;
      const teamScore = isTeamA ? match.scoreA : match.scoreB;
      const opponentScore = isTeamA ? match.scoreB : match.scoreA;

      return {
        assists: events.filter((event) => event.type === "ASSIST").length,
        fouls: events.filter((event) => event.type === "FOUL").length,
        match,
        onePointMakes: events.filter(
          (event) => event.type === "POINT" && event.points === 1,
        ).length,
        opponent: teamMap.get(isTeamA ? match.teamBId : match.teamAId),
        phase: getMatchPhase(match),
        points: events
          .filter((event) => event.type === "POINT")
          .reduce((sum, event) => sum + (event.points ?? 0), 0),
        rebounds: events.filter((event) => event.type === "REBOUND").length,
        result:
          match.status === "LIVE"
            ? "UŽIVO"
            : teamScore > opponentScore
              ? "POBEDA"
              : "PORAZ",
        score: `${match.scoreA}:${match.scoreB}`,
        team,
        twoPointMakes: events.filter(
          (event) => event.type === "POINT" && event.points === 2,
        ).length,
      } satisfies PlayerMatchStatRow;
    })
    .sort((a, b) =>
      (b.match.scheduledTime || b.match.createdAt).localeCompare(
        a.match.scheduledTime || a.match.createdAt,
      ),
    );
}

export function calculateTeamStats(
  tournamentId: string,
  source: PlayerStatsSource,
  filter: PlayerStatsFilter = defaultFilter,
): TeamStatRow[] {
  const matches = getFilteredTournamentMatches(
    tournamentId,
    source.matches,
    source.teams,
    filter,
  );
  const eligibleTeamIds = new Set(
    matches.flatMap((match) => [match.teamAId, match.teamBId]),
  );
  const rows = new Map<string, TeamStatRow>();

  for (const team of source.teams) {
    if (team.tournamentId !== tournamentId || !eligibleTeamIds.has(team.id)) {
      continue;
    }

    rows.set(team.id, createTeamRow(team));
  }

  for (const match of matches) {
    const teamA = rows.get(match.teamAId);
    const teamB = rows.get(match.teamBId);

    if (!teamA || !teamB) {
      continue;
    }

    applyMatchToTeamRows(match, teamA, teamB);
  }

  for (const event of source.events) {
    if (
      event.isDeleted ||
      !event.teamId ||
      !isStatEvent(event) ||
      !matches.some((match) => match.id === event.matchId)
    ) {
      continue;
    }

    const row = rows.get(event.teamId);

    if (row) {
      addEventToTeamRow(row, event);
    }
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      averagePointsAgainst:
        row.matchesPlayed > 0 ? row.pointsAgainst / row.matchesPlayed : 0,
      averagePointsFor:
        row.matchesPlayed > 0 ? row.pointsFor / row.matchesPlayed : 0,
      pointDifference: row.pointsFor - row.pointsAgainst,
    }))
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.pointDifference - a.pointDifference ||
        b.pointsFor - a.pointsFor ||
        a.team.name.localeCompare(b.team.name),
    );
}

export function getTournamentRecords(
  tournamentId: string,
  source: PlayerStatsSource,
  filter: PlayerStatsFilter = defaultFilter,
): TournamentRecord[] {
  const matches = getFilteredTournamentMatches(
    tournamentId,
    source.matches,
    source.teams,
    filter,
  );
  const matchMap = new Map(matches.map((match) => [match.id, match]));
  const teamMap = new Map(source.teams.map((team) => [team.id, team]));
  const playerMap = new Map(
    source.players.map((player) => [player.id, player]),
  );
  const aggregates = new Map<string, PlayerMatchAggregate>();

  for (const event of source.events) {
    if (
      event.isDeleted ||
      !event.playerId ||
      !isStatEvent(event) ||
      !matchMap.has(event.matchId)
    ) {
      continue;
    }

    const player = playerMap.get(event.playerId);
    const team = player ? teamMap.get(player.teamId) : undefined;
    const match = matchMap.get(event.matchId);

    if (!player || !team || !match) {
      continue;
    }

    const key = `${match.id}:${player.id}`;
    const aggregate =
      aggregates.get(key) ??
      createPlayerMatchAggregate(player, team, match);

    addEventToMatchAggregate(aggregate, event);
    aggregates.set(key, aggregate);
  }

  const rows = [...aggregates.values()];
  const records = [
    createPlayerRecord(
      "points",
      "Najviše poena na utakmici",
      rows,
      "points",
      "poena",
      teamMap,
    ),
    createPlayerRecord(
      "assists",
      "Najviše asistencija na utakmici",
      rows,
      "assists",
      "asist.",
      teamMap,
    ),
    createPlayerRecord(
      "rebounds",
      "Najviše skokova na utakmici",
      rows,
      "rebounds",
      "skok.",
      teamMap,
    ),
    createPlayerRecord(
      "two-pointers",
      "Najviše dvojki na utakmici",
      rows,
      "twoPointMakes",
      "pogodaka",
      teamMap,
    ),
  ];

  return records.filter((record): record is TournamentRecord => Boolean(record));
}

export function getFilteredTournamentMatches(
  tournamentId: string,
  matches: Match[],
  teams: Team[],
  filter: PlayerStatsFilter = defaultFilter,
) {
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const groupName = normalizeFilterGroup(filter.groupName);

  return matches.filter((match) => {
    if (
      match.tournamentId !== tournamentId ||
      (match.status !== "FINISHED" && match.status !== "LIVE")
    ) {
      return false;
    }

    const phase = getMatchPhase(match);

    if (
      filter.phase !== "ALL" &&
      filter.phase !== phase &&
      !(filter.phase === "KNOCKOUT" && phase !== "GROUP_STAGE")
    ) {
      return false;
    }

    if (groupName === "ALL") {
      return true;
    }

    if (phase !== "GROUP_STAGE") {
      return false;
    }

    const teamAGroup = normalizeFilterGroup(
      teamMap.get(match.teamAId)?.groupName ?? "",
    );
    const teamBGroup = normalizeFilterGroup(
      teamMap.get(match.teamBId)?.groupName ?? "",
    );

    return teamAGroup === groupName || teamBGroup === groupName;
  });
}

function getRankedRows(
  tournamentId: string,
  source: PlayerStatsSource,
  sortKey: keyof Pick<
    PlayerStatRow,
    | "assists"
    | "fouls"
    | "matchesPlayed"
    | "onePointMakes"
    | "pointActions"
    | "rebounds"
    | "totalPoints"
    | "twoPointMakes"
  >,
  filter: PlayerStatsFilter,
) {
  return calculatePlayerStats(tournamentId, source, filter)
    .filter((row) => row[sortKey] > 0)
    .sort((a, b) => compareRows(a, b, sortKey))
    .slice(0, 5)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function finalizePlayerRow(row: InternalPlayerStatRow): PlayerStatRow {
  const games = row.matchesPlayed;
  const assistsPerGame = games > 0 ? row.assists / games : 0;
  const foulsPerGame = games > 0 ? row.fouls / games : 0;
  const pointsPerGame = games > 0 ? row.totalPoints / games : 0;
  const reboundsPerGame = games > 0 ? row.rebounds / games : 0;

  return {
    assists: row.assists,
    assistsPerGame,
    fouls: row.fouls,
    foulsPerGame,
    matchesPlayed: games,
    mvpIndex: calculateMvpIndex({
      assistsPerGame,
      foulsPerGame,
      pointsPerGame,
      reboundsPerGame,
    }),
    onePointMakes: row.onePointMakes,
    player: row.player,
    pointActions: row.pointActions,
    pointsPerGame,
    rank: 0,
    rebounds: row.rebounds,
    reboundsPerGame,
    team: row.team,
    totalPoints: row.totalPoints,
    twoPointMakes: row.twoPointMakes,
    twoPointPoints: row.twoPointPoints,
  };
}

function calculateMvpIndex({
  assistsPerGame,
  foulsPerGame,
  pointsPerGame,
  reboundsPerGame,
}: {
  assistsPerGame: number;
  foulsPerGame: number;
  pointsPerGame: number;
  reboundsPerGame: number;
}) {
  return (
    pointsPerGame +
    assistsPerGame * 1.5 +
    reboundsPerGame * 1.2 -
    foulsPerGame * 0.5
  );
}

function getOrCreateRow(
  rowsByPlayerId: Map<string, InternalPlayerStatRow>,
  player: Player,
  team: Team,
) {
  const existingRow = rowsByPlayerId.get(player.id);

  if (existingRow) {
    return existingRow;
  }

  const row: InternalPlayerStatRow = {
    assists: 0,
    fouls: 0,
    matchesPlayed: 0,
    matchIds: new Set<string>(),
    onePointMakes: 0,
    player,
    pointActions: 0,
    rebounds: 0,
    team,
    totalPoints: 0,
    twoPointMakes: 0,
    twoPointPoints: 0,
  };

  rowsByPlayerId.set(player.id, row);

  return row;
}

function addEventToPlayerRow(
  row: InternalPlayerStatRow,
  event: MatchEvent,
) {
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

  if (event.type === "ASSIST") {
    row.assists += 1;
  }

  if (event.type === "REBOUND") {
    row.rebounds += 1;
  }
}

function groupStatEventsByMatch(events: MatchEvent[], playerId: string) {
  const eventsByMatchId = new Map<string, MatchEvent[]>();

  for (const event of events) {
    if (
      event.playerId !== playerId ||
      event.isDeleted ||
      !isStatEvent(event)
    ) {
      continue;
    }

    const matchEvents = eventsByMatchId.get(event.matchId) ?? [];
    matchEvents.push(event);
    eventsByMatchId.set(event.matchId, matchEvents);
  }

  return eventsByMatchId;
}

function createTeamRow(team: Team): TeamStatRow {
  return {
    assists: 0,
    averagePointsAgainst: 0,
    averagePointsFor: 0,
    fouls: 0,
    losses: 0,
    matchesPlayed: 0,
    onePointMakes: 0,
    pointDifference: 0,
    pointsAgainst: 0,
    pointsFor: 0,
    rebounds: 0,
    team,
    twoPointMakes: 0,
    wins: 0,
  };
}

function applyMatchToTeamRows(
  match: Match,
  teamA: TeamStatRow,
  teamB: TeamStatRow,
) {
  teamA.matchesPlayed += 1;
  teamA.pointsFor += match.scoreA;
  teamA.pointsAgainst += match.scoreB;

  teamB.matchesPlayed += 1;
  teamB.pointsFor += match.scoreB;
  teamB.pointsAgainst += match.scoreA;

  if (match.status !== "FINISHED" || match.scoreA === match.scoreB) {
    return;
  }

  if (match.scoreA > match.scoreB) {
    teamA.wins += 1;
    teamB.losses += 1;
  } else {
    teamB.wins += 1;
    teamA.losses += 1;
  }
}

function addEventToTeamRow(row: TeamStatRow, event: MatchEvent) {
  if (event.type === "POINT" && event.points === 1) {
    row.onePointMakes += 1;
  }

  if (event.type === "POINT" && event.points === 2) {
    row.twoPointMakes += 1;
  }

  if (event.type === "ASSIST") {
    row.assists += 1;
  }

  if (event.type === "REBOUND") {
    row.rebounds += 1;
  }

  if (event.type === "FOUL") {
    row.fouls += 1;
  }
}

function createPlayerMatchAggregate(
  player: Player,
  team: Team,
  match: Match,
): PlayerMatchAggregate {
  return {
    assists: 0,
    fouls: 0,
    match,
    onePointMakes: 0,
    player,
    points: 0,
    rebounds: 0,
    team,
    twoPointMakes: 0,
  };
}

function addEventToMatchAggregate(
  aggregate: PlayerMatchAggregate,
  event: MatchEvent,
) {
  if (event.type === "POINT") {
    aggregate.points += event.points ?? 0;

    if (event.points === 1) {
      aggregate.onePointMakes += 1;
    }

    if (event.points === 2) {
      aggregate.twoPointMakes += 1;
    }
  }

  if (event.type === "ASSIST") {
    aggregate.assists += 1;
  }

  if (event.type === "REBOUND") {
    aggregate.rebounds += 1;
  }

  if (event.type === "FOUL") {
    aggregate.fouls += 1;
  }
}

function createPlayerRecord(
  id: string,
  label: string,
  rows: PlayerMatchAggregate[],
  key: keyof Pick<
    PlayerMatchAggregate,
    "assists" | "points" | "rebounds" | "twoPointMakes"
  >,
  unit: string,
  teamMap: Map<string, Team>,
): TournamentRecord | undefined {
  const record = rows
    .filter((row) => row[key] > 0)
    .sort(
      (a, b) =>
        b[key] - a[key] ||
        b.points - a.points ||
        playerName(a.player).localeCompare(playerName(b.player)),
    )[0];

  if (!record) {
    return undefined;
  }

  return {
    context: getMatchContext(record.match, record.team.id, teamMap),
    holder: `${playerName(record.player)} · ${record.team.name}`,
    id,
    label,
    value: `${record[key]} ${unit}`,
  };
}

function getMatchContext(
  match: Match,
  teamId: string,
  teamMap: Map<string, Team>,
) {
  const opponentId = match.teamAId === teamId ? match.teamBId : match.teamAId;

  return `${phaseLabel(getMatchPhase(match))} · protiv ${
    teamMap.get(opponentId)?.name ?? "nepoznate ekipe"
  }`;
}

function isStatEvent(event: MatchEvent) {
  return (
    event.type === "POINT" ||
    event.type === "FOUL" ||
    event.type === "ASSIST" ||
    event.type === "REBOUND"
  );
}

function normalizeFilterGroup(value: string) {
  const normalized = value.trim().toUpperCase();

  return normalized || "ALL";
}

function playerName(player: Player) {
  return `${player.firstName} ${player.lastName}`.trim();
}

function phaseLabel(phase: MatchPhase) {
  const labels: Record<MatchPhase, string> = {
    FINAL: "Finale",
    GROUP_STAGE: "Grupna faza",
    QUARTER_FINAL: "Četvrtfinale",
    SEMI_FINAL: "Polufinale",
  };

  return labels[phase];
}

function compareRows(
  a: PlayerStatRow,
  b: PlayerStatRow,
  sortKey: keyof Pick<
    PlayerStatRow,
    | "assists"
    | "fouls"
    | "matchesPlayed"
    | "onePointMakes"
    | "pointActions"
    | "rebounds"
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

function compareOverallRows(a: PlayerStatRow, b: PlayerStatRow) {
  return (
    b.mvpIndex - a.mvpIndex ||
    b.pointsPerGame - a.pointsPerGame ||
    b.assistsPerGame - a.assistsPerGame ||
    b.reboundsPerGame - a.reboundsPerGame ||
    b.totalPoints - a.totalPoints ||
    a.player.lastName.localeCompare(b.player.lastName) ||
    a.player.firstName.localeCompare(b.player.firstName)
  );
}
