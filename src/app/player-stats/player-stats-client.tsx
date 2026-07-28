"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMatchEvents } from "../live-score/match-event-store";
import { useMatches, type MatchPhase } from "../matches/match-store";
import { getPlayerDisplayName, usePlayers } from "../players/player-store";
import { useTeams } from "../teams/team-store";
import { useTournaments } from "../tournaments/tournament-store";
import {
  calculatePlayerStats,
  calculateTeamStats,
  getFilteredTournamentMatches,
  getPlayerMatchStats,
  getTopAssistPlayers,
  getTopFoulPlayers,
  getTopOnePointScorers,
  getTopOverallPlayers,
  getTopReboundPlayers,
  getTopScorers,
  getTopTwoPointShooters,
  getTournamentRecords,
  type PlayerMatchStatRow,
  type PlayerStatRow,
  type PlayerStatsFilter,
  type PlayerStatsSource,
  type StatsPhaseFilter,
  type TeamStatRow,
  type TournamentRecord,
} from "./player-stats-calculator";

type StatCardConfig = {
  description: string;
  rows: PlayerStatRow[];
  statLabel: string;
  title: string;
  value: (row: PlayerStatRow) => string;
};

type PlayerSortKey =
  | "player"
  | "team"
  | "matchesPlayed"
  | "totalPoints"
  | "pointsPerGame"
  | "assists"
  | "assistsPerGame"
  | "rebounds"
  | "reboundsPerGame"
  | "onePointMakes"
  | "twoPointMakes"
  | "fouls"
  | "mvpIndex";

type SortDirection = "asc" | "desc";

const phaseFilterLabels: Record<StatsPhaseFilter, string> = {
  ALL: "Sve faze",
  FINAL: "Finale",
  GROUP_STAGE: "Grupna faza",
  KNOCKOUT: "Sve eliminacije",
  QUARTER_FINAL: "Četvrtfinale",
  SEMI_FINAL: "Polufinale",
};

export function PlayerStats() {
  const events = useMatchEvents();
  const matches = useMatches();
  const players = usePlayers();
  const teams = useTeams();
  const tournaments = useTournaments();
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [phaseFilter, setPhaseFilter] =
    useState<StatsPhaseFilter>("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");
  const [sortKey, setSortKey] = useState<PlayerSortKey>("mvpIndex");

  const activeTournamentId =
    selectedTournamentId &&
    tournaments.some((tournament) => tournament.id === selectedTournamentId)
      ? selectedTournamentId
      : tournaments[0]?.id ?? "";
  const selectedTournament = tournaments.find(
    (tournament) => tournament.id === activeTournamentId,
  );
  const source: PlayerStatsSource = useMemo(
    () => ({
      events,
      matches,
      players,
      teams,
    }),
    [events, matches, players, teams],
  );
  const tournamentTeams = useMemo(
    () =>
      selectedTournament
        ? teams.filter((team) => team.tournamentId === selectedTournament.id)
        : [],
    [selectedTournament, teams],
  );
  const groupOptions = useMemo(
    () =>
      [
        ...new Set(
          tournamentTeams
            .map((team) => team.groupName.trim().toUpperCase())
            .filter(Boolean),
        ),
      ].sort(),
    [tournamentTeams],
  );
  const activeGroupFilter =
    (phaseFilter === "ALL" || phaseFilter === "GROUP_STAGE") &&
    (groupFilter === "ALL" || groupOptions.includes(groupFilter))
      ? groupFilter
      : "ALL";
  const statsFilter: PlayerStatsFilter = useMemo(
    () => ({
      groupName: activeGroupFilter,
      phase: phaseFilter,
    }),
    [activeGroupFilter, phaseFilter],
  );
  const allPlayerRows = useMemo(
    () =>
      selectedTournament
        ? calculatePlayerStats(selectedTournament.id, source, statsFilter)
        : [],
    [selectedTournament, source, statsFilter],
  );
  const filteredMatches = useMemo(
    () =>
      selectedTournament
        ? getFilteredTournamentMatches(
            selectedTournament.id,
            matches,
            teams,
            statsFilter,
          )
        : [],
    [matches, selectedTournament, statsFilter, teams],
  );
  const teamStats = useMemo(
    () =>
      selectedTournament
        ? calculateTeamStats(selectedTournament.id, source, statsFilter)
        : [],
    [selectedTournament, source, statsFilter],
  );
  const tournamentRecords = useMemo(
    () =>
      selectedTournament
        ? getTournamentRecords(selectedTournament.id, source, statsFilter)
        : [],
    [selectedTournament, source, statsFilter],
  );
  const sortedPlayerRows = useMemo(
    () =>
      [...allPlayerRows].sort((rowA, rowB) =>
        comparePlayerRows(rowA, rowB, sortKey, sortDirection),
      ),
    [allPlayerRows, sortDirection, sortKey],
  );
  const activeSelectedPlayerId = allPlayerRows.some(
    (row) => row.player.id === selectedPlayerId,
  )
    ? selectedPlayerId
    : "";
  const selectedPlayerRow = allPlayerRows.find(
    (row) => row.player.id === activeSelectedPlayerId,
  );
  const selectedPlayerMatches = useMemo(
    () =>
      selectedTournament && activeSelectedPlayerId
        ? getPlayerMatchStats(
            selectedTournament.id,
            activeSelectedPlayerId,
            source,
            statsFilter,
          )
        : [],
    [activeSelectedPlayerId, selectedTournament, source, statsFilter],
  );
  const topScorers = selectedTournament
    ? getTopScorers(selectedTournament.id, source, statsFilter)
    : [];
  const topOverallPlayers = selectedTournament
    ? getTopOverallPlayers(selectedTournament.id, source, statsFilter)
    : [];
  const topTwoPointShooters = selectedTournament
    ? getTopTwoPointShooters(selectedTournament.id, source, statsFilter)
    : [];
  const topOnePointScorers = selectedTournament
    ? getTopOnePointScorers(selectedTournament.id, source, statsFilter)
    : [];
  const topFoulPlayers = selectedTournament
    ? getTopFoulPlayers(selectedTournament.id, source, statsFilter)
    : [];
  const topAssistPlayers = selectedTournament
    ? getTopAssistPlayers(selectedTournament.id, source, statsFilter)
    : [];
  const topReboundPlayers = selectedTournament
    ? getTopReboundPlayers(selectedTournament.id, source, statsFilter)
    : [];
  const visibleCards: StatCardConfig[] = [
    {
      description: "Ukupan zbir svih poena iz zapisnika.",
      rows: topScorers,
      statLabel: "POENI",
      title: "Najbolji poenteri",
      value: (row) => row.totalPoints.toString(),
    },
    {
      description: "Broj pogođenih šuteva za dva poena.",
      rows: topTwoPointShooters,
      statLabel: "2P",
      title: "Najbolji za 2 poena",
      value: (row) => row.twoPointMakes.toString(),
    },
    {
      description: "Broj pogođenih šuteva za jedan poen.",
      rows: topOnePointScorers,
      statLabel: "1P",
      title: "Najbolji za 1 poen",
      value: (row) => row.onePointMakes.toString(),
    },
    {
      description: "Broj upisanih asistencija iz live zapisnika.",
      rows: topAssistPlayers,
      statLabel: "ASIST",
      title: "Najbolji asistenti",
      value: (row) => row.assists.toString(),
    },
    {
      description: "Broj upisanih skokova iz live zapisnika.",
      rows: topReboundPlayers,
      statLabel: "SKOK",
      title: "Najbolji skakači",
      value: (row) => row.rebounds.toString(),
    },
    ...(topFoulPlayers.length > 0
      ? [
          {
            description: "Broj faulova koji nisu obrisani.",
            rows: topFoulPlayers,
            statLabel: "FAUL",
            title: "Najviše faulova",
            value: (row: PlayerStatRow) => row.fouls.toString(),
          },
        ]
      : []),
  ];

  function selectTournament(tournamentId: string) {
    setSelectedTournamentId(tournamentId);
    setPhaseFilter("ALL");
    setGroupFilter("ALL");
    setSelectedPlayerId("");
  }

  function selectPhase(value: StatsPhaseFilter) {
    setPhaseFilter(value);
    setSelectedPlayerId("");

    if (value !== "ALL" && value !== "GROUP_STAGE") {
      setGroupFilter("ALL");
    }
  }

  function updateSort(nextKey: PlayerSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(
      nextKey === "player" || nextKey === "team" ? "asc" : "desc",
    );
  }

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">
            Statistika iz zapisnika
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">
            Statistika igrača
          </h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Metric label="Igrači" value={allPlayerRows.length.toString()} />
          <Metric label="Ekipe" value={teamStats.length.toString()} />
          <Metric label="Mečevi" value={filteredMatches.length.toString()} />
          <Metric
            label="Događaji"
            value={countFilteredStatEvents(events, filteredMatches).toString()}
          />
        </div>
      </header>

      <section className="mt-5 rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_180px_160px_auto] xl:items-end">
          <SelectField label="Turnir">
            <select
              className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-[#0F172A] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#F97316]"
              onChange={(event) => selectTournament(event.target.value)}
              value={activeTournamentId}
            >
              {tournaments.length === 0 && (
                <option value="">Nema turnira</option>
              )}
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </SelectField>

          <SelectField label="Faza">
            <select
              className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-[#0F172A] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#F97316]"
              disabled={!selectedTournament}
              onChange={(event) =>
                selectPhase(event.target.value as StatsPhaseFilter)
              }
              value={phaseFilter}
            >
              {(Object.entries(phaseFilterLabels) as Array<
                [StatsPhaseFilter, string]
              >).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </SelectField>

          <SelectField label="Grupa">
            <select
              className="h-11 w-full min-w-0 rounded-md border border-white/10 bg-[#0F172A] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#F97316] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={
                !selectedTournament ||
                (phaseFilter !== "ALL" && phaseFilter !== "GROUP_STAGE")
              }
              onChange={(event) => {
                setGroupFilter(event.target.value);
                setSelectedPlayerId("");
              }}
              value={activeGroupFilter}
            >
              <option value="ALL">Sve grupe</option>
              {groupOptions.map((groupName) => (
                <option key={groupName} value={groupName}>
                  Grupa {groupName}
                </option>
              ))}
            </select>
          </SelectField>

          <Link
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-black text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
            href="/live-score"
          >
            Rezultat uživo
          </Link>
        </div>
      </section>

      {!selectedTournament ? (
        <EmptyState
          actionHref="/tournaments"
          actionText="Turniri"
          text="Napravite turnir da biste videli statistiku igrača."
          title="Nema turnira"
        />
      ) : allPlayerRows.length === 0 ? (
        <EmptyState
          actionHref="/live-score"
          actionText="Rezultat uživo"
          text="Za izabrani filter još nema utakmica uživo ili završenih utakmica."
          title="Nema statistike za ovaj prikaz"
        />
      ) : (
        <>
          <OverallTopPlayers rows={topOverallPlayers} />
          <TournamentRecords records={tournamentRecords} />
          <AllPlayersTable
            onSelectPlayer={setSelectedPlayerId}
            onSort={updateSort}
            rows={sortedPlayerRows}
            selectedPlayerId={activeSelectedPlayerId}
            sortDirection={sortDirection}
            sortKey={sortKey}
          />
          {selectedPlayerRow && (
            <PlayerDetails
              matchRows={selectedPlayerMatches}
              onClose={() => setSelectedPlayerId("")}
              row={selectedPlayerRow}
            />
          )}
          <TeamStatsTable rows={teamStats} />

          <section className="mt-6">
            <div>
              <p className="text-xs font-black uppercase text-[#FACC15]">
                Lideri kategorija
              </p>
              <h3 className="mt-1 text-2xl font-black text-white">
                Najbolji po statističkim kategorijama
              </h3>
            </div>
            <div className="mt-4 grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              {visibleCards.map((card) => (
                <PlayerStatCard card={card} key={card.title} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function OverallTopPlayers({ rows }: { rows: PlayerStatRow[] }) {
  return (
    <section className="mt-6 rounded-lg border border-[#F97316]/30 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
      <div>
        <p className="text-xs font-black uppercase text-[#FACC15]">
          MVP rang-lista
        </p>
        <h3 className="mt-1 text-2xl font-black text-white">
          Najbolji igrači turnira
        </h3>
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 rounded-md border border-dashed border-white/15 bg-[#0F172A] px-4 py-5 text-center text-sm text-[#94A3B8]">
          Nema dovoljno podataka za MVP rang-listu.
        </p>
      ) : (
        <div
          className="mt-5 divide-y divide-white/10"
          data-testid="top-overall-players"
        >
          {rows.map((row) => (
            <OverallPlayerRow key={row.player.id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

function OverallPlayerRow({ row }: { row: PlayerStatRow }) {
  const isLeader = row.rank === 1;

  return (
    <article
      className={`grid gap-3 px-2 py-3 lg:grid-cols-[44px_minmax(150px,1fr)_72px_minmax(430px,1.8fr)] lg:items-center ${
        isLeader ? "bg-[#F97316]/10" : ""
      }`}
    >
      <Rank value={row.rank} leader={isLeader} />

      <div className="min-w-0">
        <p className="truncate text-base font-black text-white">
          {getPlayerDisplayName(row.player)}
        </p>
        <p className="mt-1 truncate text-xs text-[#94A3B8]">{row.team.name}</p>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase text-[#94A3B8]">Mečevi</p>
        <p className="mt-1 text-lg font-black text-white">
          {row.matchesPlayed}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <CompactStat label="P / meč" value={formatAverage(row.pointsPerGame)} />
        <CompactStat
          label="A / meč"
          value={formatAverage(row.assistsPerGame)}
        />
        <CompactStat
          label="S / meč"
          value={formatAverage(row.reboundsPerGame)}
        />
        <CompactStat label="Indeks" value={formatAverage(row.mvpIndex)} accent />
      </div>
    </article>
  );
}

function TournamentRecords({ records }: { records: TournamentRecord[] }) {
  return (
    <section className="mt-6">
      <p className="text-xs font-black uppercase text-[#FACC15]">
        Rekordi turnira
      </p>
      <h3 className="mt-1 text-2xl font-black text-white">
        Najbolje pojedinačne partije
      </h3>

      {records.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-white/15 bg-[#111827] px-4 py-5 text-center text-sm text-[#94A3B8]">
          Rekordi će se pojaviti posle prvih statističkih unosa.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {records.map((record) => (
            <article
              className="min-w-0 rounded-lg border border-white/10 bg-[#111827] p-3 shadow-[0_12px_30px_rgba(2,6,23,0.2)]"
              key={record.id}
            >
              <p className="text-[10px] font-black uppercase text-[#94A3B8]">
                {record.label}
              </p>
              <p className="mt-2 text-2xl font-black text-[#FACC15]">
                {record.value}
              </p>
              <p className="mt-2 break-words text-sm font-black text-white">
                {record.holder}
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">{record.context}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AllPlayersTable({
  onSelectPlayer,
  onSort,
  rows,
  selectedPlayerId,
  sortDirection,
  sortKey,
}: {
  onSelectPlayer: (playerId: string) => void;
  onSort: (key: PlayerSortKey) => void;
  rows: PlayerStatRow[];
  selectedPlayerId: string;
  sortDirection: SortDirection;
  sortKey: PlayerSortKey;
}) {
  return (
    <section className="mt-6 rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
      <div>
        <p className="text-xs font-black uppercase text-[#FACC15]">
          Svi igrači
        </p>
        <h3 className="mt-1 text-2xl font-black text-white">
          Kompletna statistika
        </h3>
      </div>

      <div className="app-scrollbar mt-4 overflow-x-auto rounded-md border border-white/10">
        <table className="min-w-[980px] w-full border-collapse text-xs">
          <thead className="bg-[#0F172A] text-[#94A3B8]">
            <tr>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Igrač"
                onSort={onSort}
                sortKey="player"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Ekipa"
                onSort={onSort}
                sortKey="team"
              />
              <SortableHeader activeKey={sortKey} direction={sortDirection} label="M" onSort={onSort} sortKey="matchesPlayed" />
              <SortableHeader activeKey={sortKey} direction={sortDirection} label="P" onSort={onSort} sortKey="totalPoints" />
              <SortableHeader activeKey={sortKey} direction={sortDirection} label="P/M" onSort={onSort} sortKey="pointsPerGame" />
              <SortableHeader activeKey={sortKey} direction={sortDirection} label="A" onSort={onSort} sortKey="assists" />
              <SortableHeader activeKey={sortKey} direction={sortDirection} label="A/M" onSort={onSort} sortKey="assistsPerGame" />
              <SortableHeader activeKey={sortKey} direction={sortDirection} label="S" onSort={onSort} sortKey="rebounds" />
              <SortableHeader activeKey={sortKey} direction={sortDirection} label="S/M" onSort={onSort} sortKey="reboundsPerGame" />
              <SortableHeader activeKey={sortKey} direction={sortDirection} label="1P" onSort={onSort} sortKey="onePointMakes" />
              <SortableHeader activeKey={sortKey} direction={sortDirection} label="2P" onSort={onSort} sortKey="twoPointMakes" />
              <SortableHeader activeKey={sortKey} direction={sortDirection} label="F" onSort={onSort} sortKey="fouls" />
              <SortableHeader activeKey={sortKey} direction={sortDirection} label="Indeks" onSort={onSort} sortKey="mvpIndex" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = row.player.id === selectedPlayerId;

              return (
                <tr
                  className={`border-t border-white/10 transition ${
                    selected ? "bg-[#F97316]/10" : "hover:bg-white/[0.03]"
                  }`}
                  key={row.player.id}
                >
                  <td className="px-3 py-2.5">
                    <button
                      className="text-left font-black text-white transition hover:text-[#FACC15]"
                      onClick={() => onSelectPlayer(row.player.id)}
                      type="button"
                    >
                      {getPlayerDisplayName(row.player)}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-[#CBD5E1]">{row.team.name}</td>
                  <NumberCell value={row.matchesPlayed} />
                  <NumberCell value={row.totalPoints} strong />
                  <NumberCell value={formatAverage(row.pointsPerGame)} />
                  <NumberCell value={row.assists} />
                  <NumberCell value={formatAverage(row.assistsPerGame)} />
                  <NumberCell value={row.rebounds} />
                  <NumberCell value={formatAverage(row.reboundsPerGame)} />
                  <NumberCell value={row.onePointMakes} />
                  <NumberCell value={row.twoPointMakes} />
                  <NumberCell value={row.fouls} />
                  <NumberCell value={formatAverage(row.mvpIndex)} accent />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlayerDetails({
  matchRows,
  onClose,
  row,
}: {
  matchRows: PlayerMatchStatRow[];
  onClose: () => void;
  row: PlayerStatRow;
}) {
  return (
    <section className="mt-5 rounded-lg border border-[#F97316]/40 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-[#FACC15]">
            Detalji igrača
          </p>
          <h3 className="mt-1 text-2xl font-black text-white">
            {getPlayerDisplayName(row.player)}
          </h3>
          <p className="mt-1 text-sm text-[#94A3B8]">{row.team.name}</p>
        </div>
        <button
          aria-label="Zatvori detalje igrača"
          className="h-10 rounded-md border border-white/15 px-3 text-sm font-black text-[#CBD5E1] transition hover:border-[#F97316] hover:text-white"
          onClick={onClose}
          type="button"
        >
          Zatvori
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        <DetailMetric label="Mečevi" value={row.matchesPlayed.toString()} />
        <DetailMetric label="Poeni" value={row.totalPoints.toString()} />
        <DetailMetric label="P / meč" value={formatAverage(row.pointsPerGame)} />
        <DetailMetric label="Asist." value={row.assists.toString()} />
        <DetailMetric label="Skokovi" value={row.rebounds.toString()} />
        <DetailMetric label="Faulovi" value={row.fouls.toString()} />
        <DetailMetric label="MVP indeks" value={formatAverage(row.mvpIndex)} accent />
      </div>

      <div className="app-scrollbar mt-4 overflow-x-auto rounded-md border border-white/10">
        <table className="min-w-[780px] w-full border-collapse text-xs">
          <thead className="bg-[#0F172A] text-left text-[#94A3B8]">
            <tr>
              <th className="px-3 py-2">Datum</th>
              <th className="px-3 py-2">Faza</th>
              <th className="px-3 py-2">Protivnik</th>
              <th className="px-3 py-2 text-center">Rezultat</th>
              <th className="px-3 py-2 text-center">P</th>
              <th className="px-3 py-2 text-center">A</th>
              <th className="px-3 py-2 text-center">S</th>
              <th className="px-3 py-2 text-center">1P</th>
              <th className="px-3 py-2 text-center">2P</th>
              <th className="px-3 py-2 text-center">F</th>
            </tr>
          </thead>
          <tbody>
            {matchRows.map((matchRow) => (
              <tr
                className="border-t border-white/10"
                key={matchRow.match.id}
              >
                <td className="px-3 py-2 text-[#CBD5E1]">
                  {formatMatchDate(matchRow.match.scheduledTime)}
                </td>
                <td className="px-3 py-2 text-[#CBD5E1]">
                  {phaseLabel(matchRow.phase)}
                </td>
                <td className="px-3 py-2 font-black text-white">
                  {matchRow.opponent?.name ?? "Čeka protivnika"}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={resultClass(matchRow.result)}>
                    {matchRow.score} · {matchRow.result}
                  </span>
                </td>
                <NumberCell value={matchRow.points} strong />
                <NumberCell value={matchRow.assists} />
                <NumberCell value={matchRow.rebounds} />
                <NumberCell value={matchRow.onePointMakes} />
                <NumberCell value={matchRow.twoPointMakes} />
                <NumberCell value={matchRow.fouls} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TeamStatsTable({ rows }: { rows: TeamStatRow[] }) {
  return (
    <section className="mt-6 rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
      <p className="text-xs font-black uppercase text-[#FACC15]">
        Statistika ekipa
      </p>
      <h3 className="mt-1 text-2xl font-black text-white">
        Učinak ekipa
      </h3>

      <div className="app-scrollbar mt-4 overflow-x-auto rounded-md border border-white/10">
        <table className="min-w-[900px] w-full border-collapse text-xs">
          <thead className="bg-[#0F172A] text-left text-[#94A3B8]">
            <tr>
              <th className="px-3 py-2">Ekipa</th>
              <th className="px-3 py-2 text-center">M</th>
              <th className="px-3 py-2 text-center">P</th>
              <th className="px-3 py-2 text-center">I</th>
              <th className="px-3 py-2 text-center">Dato</th>
              <th className="px-3 py-2 text-center">Primljeno</th>
              <th className="px-3 py-2 text-center">+/-</th>
              <th className="px-3 py-2 text-center">Prosek</th>
              <th className="px-3 py-2 text-center">1P</th>
              <th className="px-3 py-2 text-center">2P</th>
              <th className="px-3 py-2 text-center">Asist.</th>
              <th className="px-3 py-2 text-center">Skok.</th>
              <th className="px-3 py-2 text-center">Faul.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-t border-white/10" key={row.team.id}>
                <td className="px-3 py-2.5">
                  <p className="font-black text-white">{row.team.name}</p>
                  <p className="mt-1 text-[10px] text-[#94A3B8]">
                    {row.team.groupName
                      ? `Grupa ${row.team.groupName}`
                      : "Eliminacije"}
                  </p>
                </td>
                <NumberCell value={row.matchesPlayed} />
                <NumberCell value={row.wins} strong />
                <NumberCell value={row.losses} />
                <NumberCell value={row.pointsFor} />
                <NumberCell value={row.pointsAgainst} />
                <NumberCell
                  value={formatSignedNumber(row.pointDifference)}
                  positive={row.pointDifference > 0}
                  negative={row.pointDifference < 0}
                />
                <NumberCell value={formatAverage(row.averagePointsFor)} />
                <NumberCell value={row.onePointMakes} />
                <NumberCell value={row.twoPointMakes} />
                <NumberCell value={row.assists} />
                <NumberCell value={row.rebounds} />
                <NumberCell value={row.fouls} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlayerStatCard({ card }: { card: StatCardConfig }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold tracking-normal">{card.title}</h3>
          <p className="mt-1 text-sm text-[#94A3B8]">{card.description}</p>
        </div>
        <span className="rounded-md bg-[#F97316]/15 px-2 py-1 text-xs font-black text-[#FACC15]">
          {card.statLabel}
        </span>
      </div>

      {card.rows.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-white/15 bg-[#0F172A] px-3 py-4 text-center text-sm text-[#94A3B8]">
          Nema podataka za ovu kategoriju.
        </p>
      ) : (
        <div
          className="mt-5 space-y-3"
          data-testid={`player-stat-${slugify(card.title)}`}
        >
          {card.rows.map((row) => (
            <PlayerStatListRow
              key={row.player.id}
              row={row}
              value={card.value(row)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PlayerStatListRow({
  row,
  value,
}: {
  row: PlayerStatRow;
  value: string;
}) {
  const isLeader = row.rank === 1;

  return (
    <article
      className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center ${
        isLeader
          ? "border-[#F97316]/70 bg-[#F97316]/10"
          : "border-white/10 bg-[#0F172A]"
      }`}
    >
      <Rank value={row.rank} leader={isLeader} />
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-white">
          {getPlayerDisplayName(row.player)}
        </p>
        <p className="mt-1 truncate text-xs text-[#94A3B8]">{row.team.name}</p>
      </div>
      <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
        <p className="text-xs font-bold text-[#94A3B8]">Ukupno</p>
        <p className="mt-1 text-xl font-black text-[#FACC15]">{value}</p>
      </div>
    </article>
  );
}

function SelectField({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label>
      <span className="mb-2 block text-xs font-bold uppercase text-[#94A3B8]">
        {label}
      </span>
      {children}
    </label>
  );
}

function SortableHeader({
  activeKey,
  direction,
  label,
  onSort,
  sortKey,
}: {
  activeKey: PlayerSortKey;
  direction: SortDirection;
  label: string;
  onSort: (key: PlayerSortKey) => void;
  sortKey: PlayerSortKey;
}) {
  const active = activeKey === sortKey;

  return (
    <th className="px-2 py-2 text-left">
      <button
        className={`inline-flex min-h-8 items-center gap-1 rounded px-1 text-[10px] font-black uppercase transition hover:text-white ${
          active ? "text-[#FACC15]" : "text-[#94A3B8]"
        }`}
        onClick={() => onSort(sortKey)}
        type="button"
      >
        {label}
        <span aria-hidden="true">{active ? (direction === "desc" ? "▼" : "▲") : "↕"}</span>
      </button>
    </th>
  );
}

function NumberCell({
  accent = false,
  negative = false,
  positive = false,
  strong = false,
  value,
}: {
  accent?: boolean;
  negative?: boolean;
  positive?: boolean;
  strong?: boolean;
  value: number | string;
}) {
  return (
    <td
      className={`px-2 py-2.5 text-center font-bold ${
        accent
          ? "text-[#FACC15]"
          : positive
            ? "text-[#86EFAC]"
            : negative
              ? "text-[#FCA5A5]"
              : strong
                ? "text-white"
                : "text-[#CBD5E1]"
      }`}
    >
      {value}
    </td>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-xs text-[#94A3B8]">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white">{value}</p>
    </div>
  );
}

function Rank({ leader, value }: { leader: boolean; value: number }) {
  return (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-md text-lg font-black ${
        leader ? "bg-[#F97316] text-[#111827]" : "bg-white/5 text-[#FACC15]"
      }`}
    >
      {value}
    </div>
  );
}

function CompactStat({
  accent = false,
  label,
  value,
}: {
  accent?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-[#0F172A] px-2 py-2 text-center">
      <p className="truncate text-[9px] font-black uppercase text-[#94A3B8]">
        {label}
      </p>
      <p
        className={`mt-1 text-base font-black ${
          accent ? "text-[#F97316]" : "text-[#FACC15]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DetailMetric({
  accent = false,
  label,
  value,
}: {
  accent?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0F172A] px-3 py-2 text-center">
      <p className="text-[10px] font-black uppercase text-[#94A3B8]">{label}</p>
      <p
        className={`mt-1 text-lg font-black ${
          accent ? "text-[#F97316]" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState({
  actionHref,
  actionText,
  text,
  title,
}: {
  actionHref: string;
  actionText: string;
  text: string;
  title: string;
}) {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-white/15 bg-[#111827] p-6 text-center">
      <p className="text-lg font-bold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#94A3B8]">{text}</p>
      <Link
        className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#F97316] px-3 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
        href={actionHref}
      >
        {actionText}
      </Link>
    </div>
  );
}

function comparePlayerRows(
  rowA: PlayerStatRow,
  rowB: PlayerStatRow,
  key: PlayerSortKey,
  direction: SortDirection,
) {
  const multiplier = direction === "asc" ? 1 : -1;

  if (key === "player") {
    return (
      multiplier *
      getPlayerDisplayName(rowA.player).localeCompare(
        getPlayerDisplayName(rowB.player),
      )
    );
  }

  if (key === "team") {
    return multiplier * rowA.team.name.localeCompare(rowB.team.name);
  }

  return (
    multiplier * (rowA[key] - rowB[key]) ||
    rowB.totalPoints - rowA.totalPoints ||
    getPlayerDisplayName(rowA.player).localeCompare(
      getPlayerDisplayName(rowB.player),
    )
  );
}

function countFilteredStatEvents(
  events: PlayerStatsSource["events"],
  matches: PlayerStatsSource["matches"],
) {
  const matchIds = new Set(matches.map((match) => match.id));

  return events.filter(
    (event) =>
      !event.isDeleted &&
      matchIds.has(event.matchId) &&
      (event.type === "POINT" ||
        event.type === "ASSIST" ||
        event.type === "REBOUND" ||
        event.type === "FOUL"),
  ).length;
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

function resultClass(result: PlayerMatchStatRow["result"]) {
  if (result === "POBEDA") {
    return "font-black text-[#86EFAC]";
  }

  if (result === "PORAZ") {
    return "font-black text-[#FCA5A5]";
  }

  return "font-black text-[#FACC15]";
}

function formatMatchDate(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Belgrade",
    year: "numeric",
  }).format(date);
}

function formatSignedNumber(value: number) {
  return value > 0 ? `+${value}` : value.toString();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatAverage(value: number) {
  return new Intl.NumberFormat("sr-RS", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value);
}
