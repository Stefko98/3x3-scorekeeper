import { randomUUID } from "crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "fs/promises";
import path from "path";
import type { MatchEvent } from "../live-score/match-event-store";
import type { MatchJersey } from "../live-score/match-jersey-store";
import type { Match } from "../matches/match-store";
import type { Player } from "../players/player-store";
import type { Team } from "../teams/team-store";
import type { Tournament } from "../tournaments/tournament-store";
import { isDeletionTombstone } from "./server-shared-store";

type CourtFlowBackup = {
  app: "CourtFlow";
  generatedAt: string;
  matchEvents: MatchEvent[];
  matchJerseys: MatchJersey[];
  matches: Match[];
  players: Player[];
  teams: Team[];
  tournaments: Tournament[];
  version: 1;
};

type BackupResult = {
  generatedAt: string;
  historyCreated: boolean;
  htmlPath: string;
  jsonPath: string;
};

const storageKeys = {
  matchEvents: "3x3-tournament-manager:match-events",
  matchJerseys: "3x3-tournament-manager:match-jerseys",
  matches: "3x3-tournament-manager:matches",
  players: "3x3-tournament-manager:players",
  teams: "3x3-tournament-manager:teams",
  tournaments: "3x3-tournament-manager:tournaments",
} as const;

const durableStorageKeys = new Set<string>(Object.values(storageKeys));
const dataDirectory = path.join(process.cwd(), ".shared-data");
const backupDirectory = path.join(process.cwd(), "backups");
const historyDirectory = path.join(backupDirectory, "history");
const latestHtmlPath = path.join(
  backupDirectory,
  "CourtFlow-backup-latest.html",
);
const latestJsonPath = path.join(
  backupDirectory,
  "CourtFlow-backup-latest.json",
);
const historyIntervalMs = 5 * 60 * 1_000;
const historyFileLimit = 120 * 2;

let backupQueue: Promise<unknown> = Promise.resolve();
let lastHistoryBackupAt = 0;

export function isBackupStorageKey(key: string) {
  return durableStorageKeys.has(key);
}

export function createAutomaticBackup(options?: {
  forceHistory?: boolean;
}): Promise<BackupResult> {
  const operation = backupQueue
    .catch(() => undefined)
    .then(() => generateBackup(options));

  backupQueue = operation;

  return operation;
}

async function generateBackup(options?: {
  forceHistory?: boolean;
}): Promise<BackupResult> {
  const backup = await readBackupData();
  const json = `${JSON.stringify(backup, null, 2)}\n`;
  const html = buildBackupHtml(backup);
  const nowMs = Date.now();
  const shouldCreateHistory =
    options?.forceHistory ||
    lastHistoryBackupAt === 0 ||
    nowMs - lastHistoryBackupAt >= historyIntervalMs;

  await mkdir(backupDirectory, { recursive: true });
  await atomicWriteFile(latestJsonPath, json);
  await atomicWriteFile(latestHtmlPath, html);

  if (shouldCreateHistory) {
    const historySuffix = getHistoryFileSuffix(backup.generatedAt);

    await mkdir(historyDirectory, { recursive: true });
    await atomicWriteFile(
      path.join(historyDirectory, `CourtFlow-backup-${historySuffix}.json`),
      json,
    );
    await atomicWriteFile(
      path.join(historyDirectory, `CourtFlow-backup-${historySuffix}.html`),
      html,
    );
    lastHistoryBackupAt = nowMs;
    await removeOldHistoryFiles();
  }

  return {
    generatedAt: backup.generatedAt,
    historyCreated: Boolean(shouldCreateHistory),
    htmlPath: latestHtmlPath,
    jsonPath: latestJsonPath,
  };
}

async function readBackupData(): Promise<CourtFlowBackup> {
  const [
    tournaments,
    teams,
    players,
    matches,
    matchEvents,
    matchJerseys,
  ] = await Promise.all([
    readStore<Tournament>(storageKeys.tournaments),
    readStore<Team>(storageKeys.teams),
    readStore<Player>(storageKeys.players),
    readStore<Match>(storageKeys.matches),
    readStore<MatchEvent>(storageKeys.matchEvents),
    readStore<MatchJersey>(storageKeys.matchJerseys),
  ]);

  return {
    app: "CourtFlow",
    generatedAt: new Date().toISOString(),
    matchEvents,
    matchJerseys,
    matches,
    players,
    teams,
    tournaments,
    version: 1,
  };
}

async function readStore<T>(key: string): Promise<T[]> {
  try {
    const raw = await readFile(getStorePath(key), "utf8");
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? (parsed.filter((item) => !isDeletionTombstone(item)) as T[])
      : [];
  } catch {
    return [];
  }
}

function getStorePath(key: string) {
  const fileName = Buffer.from(key).toString("base64url");

  return path.join(dataDirectory, `${fileName}.json`);
}

async function atomicWriteFile(filePath: string, content: string) {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, content, "utf8");
    await replaceFile(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function replaceFile(temporaryPath: string, destinationPath: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rename(temporaryPath, destinationPath);
      return;
    } catch (error) {
      if (!isRetryableFileError(error)) {
        throw error;
      }

      lastError = error;
    }

    try {
      await rm(destinationPath, { force: true });
      await rename(temporaryPath, destinationPath);
      return;
    } catch (error) {
      if (!isRetryableFileError(error)) {
        throw error;
      }

      lastError = error;
      await wait(20 * (attempt + 1));
    }
  }

  throw lastError;
}

async function removeOldHistoryFiles() {
  const entries = await readdir(historyDirectory, {
    withFileTypes: true,
  }).catch(() => []);
  const backupFiles = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith("CourtFlow-backup-") &&
        (entry.name.endsWith(".html") || entry.name.endsWith(".json")),
    )
    .map((entry) => entry.name)
    .sort();
  const filesToDelete = backupFiles.slice(
    0,
    Math.max(0, backupFiles.length - historyFileLimit),
  );

  await Promise.all(
    filesToDelete.map((fileName) =>
      rm(path.join(historyDirectory, fileName), { force: true }),
    ),
  );
}

function isRetryableFileError(error: unknown) {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }

  return ["EACCES", "EBUSY", "EEXIST", "EPERM"].includes(
    String(error.code),
  );
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getHistoryFileSuffix(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Belgrade",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";

  return `${part("year")}-${part("month")}-${part("day")}_${part("hour")}-${part("minute")}-${part("second")}`;
}

function buildBackupHtml(backup: CourtFlowBackup) {
  const tournamentSections = backup.tournaments
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((tournament) => buildTournamentSection(backup, tournament))
    .join("");

  return `<!doctype html>
<html lang="sr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CourtFlow automatski backup</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, Helvetica, sans-serif;
      color: #172033;
      background: #eef2f7;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef2f7; }
    main { width: min(1180px, calc(100% - 32px)); margin: 32px auto 64px; }
    h1, h2, h3, h4, p { margin-top: 0; }
    h1 { font-size: 32px; margin-bottom: 8px; }
    h2 { font-size: 25px; margin-bottom: 6px; }
    h3 { font-size: 19px; margin-bottom: 12px; }
    h4 { font-size: 15px; margin-bottom: 8px; }
    .muted { color: #60708a; }
    .header {
      padding: 28px;
      color: white;
      background: #111827;
      border-top: 6px solid #f97316;
      border-radius: 8px;
    }
    .header strong { color: #fbbf24; }
    .summary {
      display: grid;
      grid-template-columns: repeat(5, minmax(120px, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .summary-card {
      padding: 14px;
      border: 1px solid #d8dee9;
      background: white;
      border-radius: 6px;
    }
    .summary-card span { display: block; font-size: 12px; color: #60708a; }
    .summary-card strong { display: block; margin-top: 4px; font-size: 24px; color: #172033; }
    .tournament {
      margin-top: 24px;
      padding: 24px;
      background: white;
      border: 1px solid #d8dee9;
      border-radius: 8px;
      page-break-before: always;
    }
    .tournament:first-of-type { page-break-before: auto; }
    .section { margin-top: 26px; }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(140px, 1fr));
      gap: 10px;
    }
    .info-item {
      min-height: 64px;
      padding: 11px 12px;
      border: 1px solid #d8dee9;
      background: #f8fafc;
      border-radius: 5px;
    }
    .info-item span { display: block; margin-bottom: 5px; font-size: 11px; font-weight: 700; color: #60708a; text-transform: uppercase; }
    .info-item strong { font-size: 14px; }
    .group-title {
      margin: 18px 0 8px;
      padding-left: 10px;
      border-left: 4px solid #f97316;
    }
    .table-wrap { width: 100%; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 9px 10px; text-align: left; border-bottom: 1px solid #d8dee9; vertical-align: top; }
    th { color: #42526a; background: #edf2f7; font-size: 11px; text-transform: uppercase; }
    tr:last-child td { border-bottom: 0; }
    .score { white-space: nowrap; font-size: 16px; font-weight: 800; }
    .status { display: inline-block; padding: 3px 7px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #e8edf4; }
    .status-finished { color: #166534; background: #dcfce7; }
    .status-live { color: #9a3412; background: #ffedd5; }
    .status-paused { color: #854d0e; background: #fef9c3; }
    .empty { padding: 18px; color: #60708a; background: #f8fafc; border: 1px dashed #c8d1df; border-radius: 5px; }
    .team {
      margin-top: 12px;
      padding: 14px;
      border: 1px solid #d8dee9;
      border-radius: 5px;
      break-inside: avoid;
    }
    .team-heading { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; }
    details {
      margin-top: 10px;
      border: 1px solid #d8dee9;
      border-radius: 5px;
      break-inside: avoid;
    }
    summary { padding: 12px; cursor: pointer; font-weight: 700; background: #f8fafc; }
    details > div { padding: 0 12px 12px; }
    .deleted { color: #9f1239; text-decoration: line-through; opacity: .65; }
    .footer { margin-top: 24px; text-align: center; color: #60708a; font-size: 12px; }
    @media (max-width: 800px) {
      main { width: min(100% - 16px, 1180px); margin-top: 8px; }
      .header, .tournament { padding: 16px; }
      .summary { grid-template-columns: repeat(2, 1fr); }
      .info-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media print {
      body { background: white; }
      main { width: 100%; margin: 0; }
      .header { border-radius: 0; }
      .tournament { border: 0; padding: 18px 0; }
      details > div { display: block; }
      summary { list-style: none; }
    }
  </style>
</head>
<body>
  <main>
    <header class="header">
      <h1>CourtFlow automatski backup</h1>
      <p>Pregled svih sačuvanih podataka aplikacije.</p>
      <p>Backup napravljen: <strong>${escapeHtml(formatDateTime(backup.generatedAt))}</strong></p>
    </header>

    <section class="summary" aria-label="Ukupan sadržaj backupa">
      ${summaryCard("Turniri", backup.tournaments.length)}
      ${summaryCard("Ekipe", backup.teams.length)}
      ${summaryCard("Igrači", backup.players.length)}
      ${summaryCard("Utakmice", backup.matches.length)}
      ${summaryCard("Događaji", backup.matchEvents.length)}
    </section>

    ${
      tournamentSections ||
      '<section class="tournament"><div class="empty">Još nema sačuvanih turnira.</div></section>'
    }

    <footer class="footer">
      CourtFlow backup verzija ${backup.version}. JSON datoteka pored ovog dokumenta služi za potpuno vraćanje podataka.
    </footer>
  </main>
</body>
</html>
`;
}

function buildTournamentSection(
  backup: CourtFlowBackup,
  tournament: Tournament,
) {
  const teams = backup.teams
    .filter((team) => team.tournamentId === tournament.id)
    .sort(compareTeams);
  const teamIds = new Set(teams.map((team) => team.id));
  const players = backup.players
    .filter(
      (player) =>
        player.tournamentId === tournament.id || teamIds.has(player.teamId),
    )
    .sort(comparePlayers);
  const matches = backup.matches
    .filter((match) => match.tournamentId === tournament.id)
    .sort(compareMatches);
  const matchIds = new Set(matches.map((match) => match.id));
  const events = backup.matchEvents
    .filter(
      (event) =>
        event.tournamentId === tournament.id || matchIds.has(event.matchId),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const jerseys = backup.matchJerseys.filter((jersey) =>
    matchIds.has(jersey.matchId),
  );
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const matchMap = new Map(matches.map((match) => [match.id, match]));
  const jerseyMap = new Map(
    jerseys.map((jersey) => [
      `${jersey.matchId}:${jersey.playerId}`,
      jersey.jerseyNumber,
    ]),
  );

  return `<section class="tournament">
    <h2>${escapeHtml(tournament.name)}</h2>
    <p class="muted">${escapeHtml(tournament.description || "Bez opisa turnira")}</p>

    <div class="info-grid">
      ${infoItem("Mesto", [tournament.location, tournament.city].filter(Boolean).join(", ") || "-")}
      ${infoItem("Datum", formatDateRange(tournament.startDate, tournament.endDate))}
      ${infoItem("Format", tournamentTypeLabel(tournament.tournamentType))}
      ${infoItem("Status", tournamentStatusLabel(tournament.status))}
      ${infoItem("Broj grupa", tournament.groupCount ?? "-")}
      ${infoItem("Knockout ekipe", tournament.knockoutTeams ?? "-")}
      ${infoItem("Maksimalno ekipa", tournament.maxTeams)}
      ${infoItem("ID turnira", tournament.id)}
    </div>

    ${buildTeamsSection(teams, players)}
    ${buildMatchesSection(matches, teamMap)}
    ${buildPlayerStatsSection(players, matches, events, teamMap)}
    ${buildEventLogSection(events, matchMap, teamMap, playerMap, jerseyMap)}
  </section>`;
}

function buildTeamsSection(teams: Team[], players: Player[]) {
  const groups = [...new Set(teams.map((team) => team.groupName || "Bez grupe"))]
    .sort((a, b) => a.localeCompare(b));

  return `<section class="section">
    <h3>Ekipe i igrači</h3>
    ${
      teams.length === 0
        ? '<div class="empty">Nema dodatih ekipa.</div>'
        : groups
            .map((groupName) => {
              const groupTeams = teams.filter(
                (team) => (team.groupName || "Bez grupe") === groupName,
              );

              return `<div class="group-title"><h4>${escapeHtml(groupName === "Bez grupe" ? groupName : `Grupa ${groupName}`)}</h4></div>
                ${groupTeams
                  .map((team) => {
                    const teamPlayers = players.filter(
                      (player) => player.teamId === team.id,
                    );

                    return `<article class="team">
                      <div class="team-heading">
                        <h4>${escapeHtml(team.name)}</h4>
                        <span class="status">${escapeHtml(teamStatusLabel(team.status))}</span>
                      </div>
                      <p class="muted">${escapeHtml(team.city || "-")} · Broj kapitena: ${escapeHtml(team.captainPhone || "-")}</p>
                      ${
                        teamPlayers.length === 0
                          ? '<p class="muted">Nema dodatih igrača.</p>'
                          : `<div class="table-wrap"><table>
                              <thead><tr><th>Ime i prezime</th><th>ID igrača</th></tr></thead>
                              <tbody>${teamPlayers
                                .map(
                                  (player) =>
                                    `<tr><td><strong>${escapeHtml(playerName(player))}</strong></td><td>${escapeHtml(player.id)}</td></tr>`,
                                )
                                .join("")}</tbody>
                            </table></div>`
                      }
                    </article>`;
                  })
                  .join("")}`;
            })
            .join("")
    }
  </section>`;
}

function buildMatchesSection(matches: Match[], teamMap: Map<string, Team>) {
  return `<section class="section">
    <h3>Utakmice i rezultati</h3>
    ${
      matches.length === 0
        ? '<div class="empty">Nema kreiranih utakmica.</div>'
        : `<div class="table-wrap"><table>
            <thead>
              <tr><th>Faza</th><th>Utakmica</th><th>Vreme</th><th>Status</th><th>Rezultat</th><th>Faulovi</th><th>Pobednik</th></tr>
            </thead>
            <tbody>
              ${matches
                .map((match) => {
                  const teamA = teamMap.get(match.teamAId);
                  const teamB = teamMap.get(match.teamBId);
                  const winner = match.winnerTeamId
                    ? teamMap.get(match.winnerTeamId)?.name
                    : undefined;

                  return `<tr>
                    <td>${escapeHtml(matchPhaseLabel(match.matchPhase))}</td>
                    <td><strong>${escapeHtml(teamA?.name ?? "Čeka protivnika")} – ${escapeHtml(teamB?.name ?? "Čeka protivnika")}</strong><br><span class="muted">${escapeHtml(match.id)}</span></td>
                    <td>${escapeHtml(formatDateTime(match.scheduledTime))}</td>
                    <td><span class="status ${statusClass(match.status)}">${escapeHtml(matchStatusLabel(match.status))}</span></td>
                    <td class="score">${match.scoreA}:${match.scoreB}</td>
                    <td>${match.foulsA}:${match.foulsB}</td>
                    <td>${escapeHtml(winner ?? "-")}</td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table></div>`
    }
  </section>`;
}

function buildPlayerStatsSection(
  players: Player[],
  matches: Match[],
  events: MatchEvent[],
  teamMap: Map<string, Team>,
) {
  const activeEvents = events.filter((event) => !event.isDeleted);
  const playedMatchIdsByTeam = new Map<string, Set<string>>();

  for (const match of matches) {
    if (match.status !== "FINISHED" && match.status !== "LIVE") {
      continue;
    }

    for (const teamId of [match.teamAId, match.teamBId]) {
      const matchIds = playedMatchIdsByTeam.get(teamId) ?? new Set<string>();
      matchIds.add(match.id);
      playedMatchIdsByTeam.set(teamId, matchIds);
    }
  }

  const rows = players
    .map((player) => {
      const playerEvents = activeEvents.filter(
        (event) => event.playerId === player.id,
      );

      return {
        assists: playerEvents.filter((event) => event.type === "ASSIST").length,
        fouls: playerEvents.filter((event) => event.type === "FOUL").length,
        games: playedMatchIdsByTeam.get(player.teamId)?.size ?? 0,
        player,
        points: playerEvents
          .filter((event) => event.type === "POINT")
          .reduce((sum, event) => sum + (event.points ?? 0), 0),
        rebounds: playerEvents.filter((event) => event.type === "REBOUND").length,
        team: teamMap.get(player.teamId),
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.assists - a.assists ||
        playerName(a.player).localeCompare(playerName(b.player)),
    );

  return `<section class="section">
    <h3>Statistika igrača</h3>
    ${
      rows.length === 0
        ? '<div class="empty">Nema dodatih igrača.</div>'
        : `<div class="table-wrap"><table>
            <thead><tr><th>Igrač</th><th>Ekipa</th><th>Utakmice</th><th>Poeni</th><th>Asistencije</th><th>Skokovi</th><th>Faulovi</th></tr></thead>
            <tbody>${rows
              .map(
                (row) =>
                  `<tr><td><strong>${escapeHtml(playerName(row.player))}</strong></td><td>${escapeHtml(row.team?.name ?? "-")}</td><td>${row.games}</td><td>${row.points}</td><td>${row.assists}</td><td>${row.rebounds}</td><td>${row.fouls}</td></tr>`,
              )
              .join("")}</tbody>
          </table></div>`
    }
  </section>`;
}

function buildEventLogSection(
  events: MatchEvent[],
  matchMap: Map<string, Match>,
  teamMap: Map<string, Team>,
  playerMap: Map<string, Player>,
  jerseyMap: Map<string, number>,
) {
  const eventsByMatch = new Map<string, MatchEvent[]>();

  for (const event of events) {
    const matchEvents = eventsByMatch.get(event.matchId) ?? [];
    matchEvents.push(event);
    eventsByMatch.set(event.matchId, matchEvents);
  }

  return `<section class="section">
    <h3>Kompletan zapisnik</h3>
    ${
      events.length === 0
        ? '<div class="empty">Nema događaja u zapisniku.</div>'
        : [...eventsByMatch.entries()]
            .map(([matchId, matchEvents]) => {
              const match = matchMap.get(matchId);
              const teamA = match ? teamMap.get(match.teamAId) : undefined;
              const teamB = match ? teamMap.get(match.teamBId) : undefined;
              const title = match
                ? `${teamA?.name ?? "Čeka protivnika"} – ${teamB?.name ?? "Čeka protivnika"}`
                : `Utakmica ${matchId}`;

              return `<details>
                <summary>${escapeHtml(title)} · ${matchEvents.length} događaja</summary>
                <div class="table-wrap"><table>
                  <thead><tr><th>Sat</th><th>Vreme unosa</th><th>Događaj</th><th>Igrač</th><th>Ekipa</th><th>Rezultat</th></tr></thead>
                  <tbody>${matchEvents
                    .map((event) => {
                      const player = event.playerId
                        ? playerMap.get(event.playerId)
                        : undefined;
                      const team = event.teamId
                        ? teamMap.get(event.teamId)
                        : undefined;
                      const jerseyNumber = event.playerId
                        ? event.jerseyNumber ??
                          jerseyMap.get(`${event.matchId}:${event.playerId}`)
                        : undefined;

                      return `<tr class="${event.isDeleted ? "deleted" : ""}">
                        <td><strong>${escapeHtml(event.clock)}</strong></td>
                        <td>${escapeHtml(formatDateTime(event.createdAt))}</td>
                        <td>${escapeHtml(eventLabel(event))}${event.isDeleted ? " (obrisano)" : ""}</td>
                        <td>${escapeHtml(player ? `${jerseyNumber !== undefined ? `#${jerseyNumber} ` : ""}${playerName(player)}` : "-")}</td>
                        <td>${escapeHtml(team?.name ?? "-")}</td>
                        <td>${event.scoreA !== undefined && event.scoreB !== undefined ? `${event.scoreA}:${event.scoreB}` : "-"}</td>
                      </tr>`;
                    })
                    .join("")}</tbody>
                </table></div>
              </details>`;
            })
            .join("")
    }
  </section>`;
}

function summaryCard(label: string, value: number) {
  return `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function infoItem(label: string, value: string | number) {
  return `<div class="info-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function playerName(player: Player) {
  return `${player.firstName} ${player.lastName}`.trim();
}

function compareTeams(teamA: Team, teamB: Team) {
  return (
    (teamA.groupName || "ZZ").localeCompare(teamB.groupName || "ZZ") ||
    teamA.name.localeCompare(teamB.name)
  );
}

function comparePlayers(playerA: Player, playerB: Player) {
  return (
    playerA.teamId.localeCompare(playerB.teamId) ||
    playerName(playerA).localeCompare(playerName(playerB))
  );
}

function compareMatches(matchA: Match, matchB: Match) {
  return (
    (matchA.scheduledTime || matchA.createdAt).localeCompare(
      matchB.scheduledTime || matchB.createdAt,
    ) || matchA.id.localeCompare(matchB.id)
  );
}

function formatDateRange(startDate: string, endDate: string) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  return start === end ? start : `${start} – ${end}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Belgrade",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Belgrade",
    year: "numeric",
  }).format(date);
}

function tournamentStatusLabel(status: Tournament["status"]) {
  const labels: Record<Tournament["status"], string> = {
    CANCELLED: "Otkazan",
    DRAFT: "U pripremi",
    FINISHED: "Završen",
    ONGOING: "U toku",
    REGISTRATION_CLOSED: "Prijave zatvorene",
    REGISTRATION_OPEN: "Prijave otvorene",
  };

  return labels[status] ?? status;
}

function tournamentTypeLabel(type: Tournament["tournamentType"]) {
  const labels: Record<Tournament["tournamentType"], string> = {
    GROUPS_AND_KNOCKOUT: "Grupe i eliminacije",
    GROUP_STAGE: "Grupna faza",
    KNOCKOUT: "Eliminacije",
    LEAGUE: "Liga",
  };

  return labels[type] ?? type;
}

function teamStatusLabel(status: Team["status"]) {
  const labels: Record<Team["status"], string> = {
    CONFIRMED: "Potvrđena",
    DISQUALIFIED: "Diskvalifikovana",
    REGISTERED: "Prijavljena",
    WITHDRAWN: "Odustala",
  };

  return labels[status] ?? status;
}

function matchPhaseLabel(phase: Match["matchPhase"]) {
  const labels: Record<Match["matchPhase"], string> = {
    FINAL: "Finale",
    GROUP_STAGE: "Grupna faza",
    QUARTER_FINAL: "Četvrtfinale",
    SEMI_FINAL: "Polufinale",
    THIRD_PLACE: "Za treće mesto",
  };

  return labels[phase] ?? phase;
}

function matchStatusLabel(status: Match["status"]) {
  const labels: Record<Match["status"], string> = {
    CANCELLED: "Otkazana",
    FINISHED: "Završena",
    LIVE: "Uživo",
    PAUSED: "Pauzirana",
    SCHEDULED: "Zakazana",
  };

  return labels[status] ?? status;
}

function statusClass(status: Match["status"]) {
  if (status === "FINISHED") {
    return "status-finished";
  }

  if (status === "LIVE") {
    return "status-live";
  }

  if (status === "PAUSED") {
    return "status-paused";
  }

  return "";
}

function eventLabel(event: MatchEvent) {
  if (event.description) {
    return event.description;
  }

  const labels: Record<MatchEvent["type"], string> = {
    ASSIST: "Asistencija",
    DELETE_EVENT: "Ispravka događaja",
    FINISH_MATCH: "Kraj utakmice",
    FOUL: "Faul",
    PAUSE_MATCH: "Pauza",
    POINT: `Pogodak za ${event.points ?? 0} poena`,
    REBOUND: "Skok",
    RESUME_MATCH: "Nastavak utakmice",
    START_MATCH: "Početak utakmice",
    START_OVERTIME: "Početak produžetka",
  };

  return labels[event.type] ?? event.type;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
