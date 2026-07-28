"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { KnockoutBracket } from "../matches/knockout-bracket";
import {
  getMatchPhase,
  useMatches,
  type Match,
} from "../matches/match-store";
import { useTeams, type Team } from "../teams/team-store";
import { getTournamentFormat } from "../tournaments/tournament-format";
import { useTournaments } from "../tournaments/tournament-store";
import {
  calculateStandings,
  type StandingGroup,
  type StandingRow,
} from "./standings-calculator";

export function StandingsClient() {
  const matches = useMatches();
  const teams = useTeams();
  const tournaments = useTournaments();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>();

  const selectedTournament =
    tournaments.find((tournament) => tournament.id === selectedTournamentId) ??
    tournaments[0];
  const tournamentTeams = useMemo(
    () =>
      selectedTournament
        ? teams.filter((team) => team.tournamentId === selectedTournament.id)
        : [],
    [selectedTournament, teams],
  );
  const tournamentMatches = useMemo(
    () =>
      selectedTournament
        ? matches.filter((match) => match.tournamentId === selectedTournament.id)
        : [],
    [matches, selectedTournament],
  );
  const unassignedTeams = useMemo(
    () => tournamentTeams.filter((team) => !team.groupName.trim()),
    [tournamentTeams],
  );
  const groupMatches = useMemo(
    () =>
      tournamentMatches.filter(
        (match) => getMatchPhase(match) === "GROUP_STAGE",
      ),
    [tournamentMatches],
  );
  const tournamentFormat = getTournamentFormat(
    selectedTournament,
    tournamentTeams.length,
  );
  const knockoutMatches = useMemo(
    () =>
      tournamentMatches.filter(
        (match) => getMatchPhase(match) !== "GROUP_STAGE",
      ),
    [tournamentMatches],
  );
  const finishedMatches = groupMatches.filter(
    (match) => match.status === "FINISHED",
  );
  const pendingMatches = groupMatches.filter(
    (match) => match.status === "SCHEDULED" || match.status === "LIVE",
  );
  const groups = useMemo(
    () =>
      calculateStandings({
        matches: groupMatches,
        teams: tournamentTeams,
      }),
    [groupMatches, tournamentTeams],
  );
  const leader = groups.flatMap((group) => group.rows)[0];

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">
            Poredak ekipa
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">Tabele</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Ekipe" value={tournamentTeams.length.toString()} />
          <Metric label="Odigrano" value={finishedMatches.length.toString()} />
          <Metric label="Čeka" value={pendingMatches.length.toString()} />
          <Metric label="Lider" value={leader?.team.name ?? "-"} />
        </div>
      </header>

      {tournaments.length === 0 ? (
        <EmptyState
          actionHref="/tournaments"
          actionText="Napravi turnir"
          text="Tabela se pravi iz ekipa i završenih utakmica."
          title="Prvo napravi turnir"
        />
      ) : tournamentTeams.length === 0 ? (
        <EmptyState
          actionHref="/teams"
          actionText="Dodaj ekipe"
          text="Kada dodas ekipe, tabela će prikazati poredak za taj turnir."
          title="Nema ekipa za tabelu"
        />
      ) : (
        <div className="mt-6 grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 space-y-6">
            <div className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
                <div>
                  <label
                    className="text-sm font-semibold text-[#CBD5E1]"
                    htmlFor="standings-tournament"
                  >
                    Turnir
                  </label>
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-white/10 bg-[#0F172A] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#F97316]"
                    id="standings-tournament"
                    onChange={(event) => setSelectedTournamentId(event.target.value)}
                    value={selectedTournament?.id ?? ""}
                  >
                    {tournaments.map((tournament) => (
                      <option key={tournament.id} value={tournament.id}>
                        {tournament.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-md bg-[#F97316] px-4 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
                  href="/matches"
                >
                  Utakmice
                </Link>
              </div>
            </div>

            {unassignedTeams.length > 0 ? (
              <EmptyState
                actionHref="/teams"
                actionText="Rasporedi ekipe"
                text={`Neraspoređenih ekipa: ${unassignedTeams.length}.`}
                title="Prvo rasporedite ekipe po grupama"
              />
            ) : (
              <>
                {groups.map((group) => (
                  <StandingsGroupTable key={group.groupName} group={group} />
                ))}

                {selectedTournament && (
                  <KnockoutBracket
                    knockoutTeams={tournamentFormat.knockoutTeams}
                    matches={tournamentMatches}
                    teams={tournamentTeams}
                    tournamentId={selectedTournament.id}
                  />
                )}
              </>
            )}
          </section>

          <aside className="min-w-0 space-y-6">
            <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
              <h3 className="text-xl font-bold tracking-normal">
                Forma turnira
              </h3>
              <p className="mt-1 text-sm text-[#94A3B8]">
                {selectedTournament?.name ?? "Izaberi turnir"}
              </p>

              <div className="mt-5 grid gap-3">
                <SmallMetric
                  label="Grupe"
                  value={groups.length}
                />
                <SmallMetric
                  label="Završeno"
                  value={`${finishedMatches.length}/${groupMatches.length}`}
                />
                <SmallMetric
                  label="Knockout"
                  value={knockoutMatches.length}
                />
                <SmallMetric
                  label="Ukupno poena"
                  value={finishedMatches
                    .reduce(
                      (total, match) => total + match.scoreA + match.scoreB,
                      0,
                    )
                    .toString()}
                />
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold tracking-normal">
                    Rezultati
                  </h3>
                  <p className="mt-1 text-sm text-[#94A3B8]">
                    Završene utakmice iz grupne faze koje ulaze u tabelu.
                  </p>
                </div>
                <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-bold text-[#CBD5E1]">
                  {finishedMatches.length}
                </span>
              </div>

              {finishedMatches.length === 0 ? (
                <div className="mt-5 rounded-lg border border-dashed border-white/15 bg-[#0F172A] p-4 text-center">
                  <p className="text-sm font-bold text-white">
                    Jos nema rezultata
                  </p>
                  <p className="mt-1 text-xs text-[#94A3B8]">
                    Završi utakmicu da se pojavi u tabeli.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3">
                  {finishedMatches.slice(0, 6).map((match) => (
                    <ResultRow
                      key={match.id}
                      match={match}
                      teamA={teams.find((team) => team.id === match.teamAId)}
                      teamB={teams.find((team) => team.id === match.teamBId)}
                    />
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function StandingsGroupTable({ group }: { group: StandingGroup }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-normal">{group.groupName}</h3>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Poredak po završenim utakmicama.
          </p>
        </div>
        <span className="rounded-md bg-[#F97316]/15 px-2 py-1 text-xs font-black text-[#FACC15]">
          {group.rows.length} ekipa
        </span>
      </div>

      <div className="app-scrollbar mt-5 overflow-x-auto rounded-md border border-white/10">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead className="bg-[#182235]">
            <tr className="border-b border-white/10 text-xs uppercase text-[#CBD5E1]">
              <th className="px-3 py-3 font-black">#</th>
              <th className="px-3 py-3 font-black">Ekipa</th>
              <th className="px-3 py-3 text-center font-black">M</th>
              <th className="px-3 py-3 text-center font-black">P</th>
              <th className="px-3 py-3 text-center font-black">I</th>
              <th className="px-3 py-3 text-center font-black">Dato</th>
              <th className="px-3 py-3 text-center font-black">Primlj.</th>
              <th className="px-3 py-3 text-center font-black">+/-</th>
              <th className="px-3 py-3 text-center font-black">Bod</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <StandingTableRow key={row.team.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StandingTableRow({ row }: { row: StandingRow }) {
  return (
    <tr className="border-b border-white/10 transition odd:bg-white/[0.015] hover:bg-white/[0.045] last:border-b-0">
      <td className="px-3 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0F172A] text-sm font-black text-[#FACC15]">
          {row.rank}
        </span>
      </td>
      <td className="px-3 py-4">
        <p className="font-black text-white">{row.team.name}</p>
        <p className="mt-1 text-xs text-[#94A3B8]">{row.team.city}</p>
      </td>
      <StatCell value={row.played} />
      <StatCell value={row.wins} />
      <StatCell value={row.losses} />
      <StatCell value={row.pointsFor} />
      <StatCell value={row.pointsAgainst} />
      <StatCell
        tone={row.pointDifference > 0 ? "positive" : row.pointDifference < 0 ? "negative" : "neutral"}
        value={row.pointDifference}
      />
      <StatCell strong value={row.points} />
    </tr>
  );
}

function ResultRow({
  match,
  teamA,
  teamB,
}: {
  match: Match;
  teamA?: Team;
  teamB?: Team;
}) {
  const teamAWon = match.scoreA > match.scoreB;
  const teamBWon = match.scoreB > match.scoreA;

  return (
    <article className="rounded-md border border-white/10 bg-[#0F172A] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-bold ${
              teamAWon ? "text-[#86EFAC]" : "text-white"
            }`}
          >
            {teamA?.name ?? "Ekipa A"}
          </p>
          <p
            className={`mt-1 truncate text-sm font-bold ${
              teamBWon ? "text-[#86EFAC]" : "text-white"
            }`}
          >
            {teamB?.name ?? "Ekipa B"}
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-center">
          <p className="text-lg font-black text-white">
            {match.scoreA}:{match.scoreB}
          </p>
        </div>
      </div>
    </article>
  );
}

function StatCell({
  strong = false,
  tone = "neutral",
  value,
}: {
  strong?: boolean;
  tone?: "negative" | "neutral" | "positive";
  value: number;
}) {
  const toneClassName =
    tone === "positive"
      ? "text-[#86EFAC]"
      : tone === "negative"
        ? "text-[#FCA5A5]"
        : "text-white";

  return (
    <td
      className={`px-3 py-4 text-center ${strong ? "text-lg font-black" : "font-bold"} ${toneClassName}`}
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

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0F172A] px-3 py-2">
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
