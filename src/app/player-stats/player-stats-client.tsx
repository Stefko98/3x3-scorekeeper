"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMatchEvents } from "../live-score/match-event-store";
import { useMatches } from "../matches/match-store";
import { getPlayerDisplayName, usePlayers } from "../players/player-store";
import { useTeams } from "../teams/team-store";
import { useTournaments } from "../tournaments/tournament-store";
import {
  getMostActivePlayers,
  getTopFoulPlayers,
  getTopOnePointScorers,
  getTopScorers,
  getTopTwoPointShooters,
  type PlayerStatRow,
  type PlayerStatsSource,
} from "./player-stats-calculator";

type StatCardConfig = {
  description: string;
  rows: PlayerStatRow[];
  statLabel: string;
  title: string;
  value: (row: PlayerStatRow) => string;
};

export function PlayerStats() {
  const events = useMatchEvents();
  const matches = useMatches();
  const players = usePlayers();
  const teams = useTeams();
  const tournaments = useTournaments();
  const [selectedTournamentId, setSelectedTournamentId] = useState("");

  const selectedTournament = tournaments.find(
    (tournament) => tournament.id === selectedTournamentId,
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
  const topScorers = selectedTournament
    ? getTopScorers(selectedTournament.id, source)
    : [];
  const topTwoPointShooters = selectedTournament
    ? getTopTwoPointShooters(selectedTournament.id, source)
    : [];
  const topOnePointScorers = selectedTournament
    ? getTopOnePointScorers(selectedTournament.id, source)
    : [];
  const mostActivePlayers = selectedTournament
    ? getMostActivePlayers(selectedTournament.id, source)
    : [];
  const topFoulPlayers = selectedTournament
    ? getTopFoulPlayers(selectedTournament.id, source)
    : [];
  const tournamentMatches = selectedTournament
    ? matches.filter((match) => match.tournamentId === selectedTournament.id)
    : [];
  const liveOrFinishedMatches = tournamentMatches.filter(
    (match) => match.status === "FINISHED" || match.status === "LIVE",
  );
  const tournamentTeams = selectedTournament
    ? teams.filter((team) => team.tournamentId === selectedTournament.id)
    : [];
  const visibleCards: StatCardConfig[] = [
    {
      description: "Ukupan zbir svih POINT dogadjaja.",
      rows: topScorers,
      statLabel: "PTS",
      title: "Top 5 poentera",
      value: (row) => row.totalPoints.toString(),
    },
    {
      description: "Broj pogodjenih suteva gde je points = 2.",
      rows: topTwoPointShooters,
      statLabel: "2PT",
      title: "Top 5 za 2 poena",
      value: (row) => `${row.twoPointMakes} / ${row.twoPointPoints} pts`,
    },
    {
      description: "Broj pogodjenih suteva gde je points = 1.",
      rows: topOnePointScorers,
      statLabel: "1PT",
      title: "Top 5 za 1 poen",
      value: (row) => row.onePointMakes.toString(),
    },
    {
      description: "Broj poenterskih akcija iz POINT dogadjaja.",
      rows: mostActivePlayers,
      statLabel: "ACT",
      title: "Najaktivniji igraci",
      value: (row) => row.pointActions.toString(),
    },
    ...(topFoulPlayers.length > 0
      ? [
          {
            description: "Broj FOUL dogadjaja koji nisu obrisani.",
            rows: topFoulPlayers,
            statLabel: "FOUL",
            title: "Najvise faulova",
            value: (row: PlayerStatRow) => row.fouls.toString(),
          },
        ]
      : []),
  ];

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">
            Player analytics
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">
            Statistika igraca
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Igraci" value={players.length.toString()} />
          <Metric label="Ekipe" value={tournamentTeams.length.toString()} />
          <Metric label="Mecevi" value={tournamentMatches.length.toString()} />
          <Metric
            label="Live/Finished"
            value={liveOrFinishedMatches.length.toString()}
          />
        </div>
      </header>

      <section className="mt-6 rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label
              className="text-sm font-semibold text-[#CBD5E1]"
              htmlFor="player-stats-tournament"
            >
              Turnir
            </label>
            <select
              className="mt-2 h-11 w-full rounded-md border border-white/10 bg-[#0F172A] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#F97316]"
              id="player-stats-tournament"
              onChange={(event) => setSelectedTournamentId(event.target.value)}
              value={selectedTournamentId}
            >
              <option value="">Izaberite turnir</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-black text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
            href="/live-score"
          >
            Live score
          </Link>
        </div>
      </section>

      {!selectedTournament ? (
        <EmptyState
          actionHref="/tournaments"
          actionText="Turniri"
          text="Izaberite turnir da biste videli statistiku igraca."
          title="Nije izabran turnir"
        />
      ) : visibleCards.every((card) => card.rows.length === 0) ? (
        <EmptyState
          actionHref="/live-score"
          actionText="Unesi poene"
          text="Statistika ce se pojaviti kada postoje POINT dogadjaji iz LIVE ili FINISHED utakmica."
          title="Jos nema statistike"
        />
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {visibleCards.map((card) => (
            <PlayerStatCard card={card} key={card.title} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerStatCard({ card }: { card: StatCardConfig }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
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
        <div className="mt-5 space-y-3" data-testid={`player-stat-${slugify(card.title)}`}>
          {card.rows.map((row) => (
            <PlayerStatListRow key={row.player.id} row={row} value={card.value(row)} />
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
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-md text-lg font-black ${
          isLeader ? "bg-[#F97316] text-[#111827]" : "bg-white/5 text-[#FACC15]"
        }`}
      >
        {row.rank}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-white">
          #{row.player.jerseyNumber} {getPlayerDisplayName(row.player)}
        </p>
        <p className="mt-1 truncate text-xs text-[#94A3B8]">{row.team.name}</p>
      </div>
      <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
        <p className="text-xs font-bold text-[#94A3B8]">Total</p>
        <p className="mt-1 text-xl font-black text-[#FACC15]">{value}</p>
      </div>
    </article>
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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
