"use client";

import Link from "next/link";
import { useMatches, type Match, type MatchStatus } from "./matches/match-store";
import { usePlayers } from "./players/player-store";
import { useTeams, type Team } from "./teams/team-store";
import {
  useTournaments,
  type Tournament,
  type TournamentStatus,
} from "./tournaments/tournament-store";

const statusLabels: Record<TournamentStatus, string> = {
  DRAFT: "Draft",
  REGISTRATION_OPEN: "Registration open",
  REGISTRATION_CLOSED: "Registration closed",
  ONGOING: "Ongoing",
  FINISHED: "Finished",
  CANCELLED: "Cancelled",
};

const statusStyles: Record<TournamentStatus, string> = {
  DRAFT: "bg-white/10 text-[#CBD5E1]",
  REGISTRATION_OPEN: "bg-[#22C55E]/15 text-[#86EFAC]",
  REGISTRATION_CLOSED: "bg-[#FACC15]/15 text-[#FDE68A]",
  ONGOING: "bg-[#F97316]/15 text-[#FDBA74]",
  FINISHED: "bg-[#38BDF8]/15 text-[#7DD3FC]",
  CANCELLED: "bg-[#EF4444]/15 text-[#FCA5A5]",
};

const matchStatusLabels: Record<MatchStatus, string> = {
  CANCELLED: "Cancelled",
  FINISHED: "Finished",
  LIVE: "Live",
  PAUSED: "Paused",
  SCHEDULED: "Scheduled",
};

const matchStatusStyles: Record<MatchStatus, string> = {
  CANCELLED: "bg-white/10 text-[#CBD5E1]",
  FINISHED: "bg-[#38BDF8]/15 text-[#7DD3FC]",
  LIVE: "bg-[#22C55E]/15 text-[#86EFAC]",
  PAUSED: "bg-[#FACC15]/15 text-[#FDE68A]",
  SCHEDULED: "bg-[#F97316]/15 text-[#FDBA74]",
};

export function DashboardClient() {
  const matches = useMatches();
  const players = usePlayers();
  const teams = useTeams();
  const tournaments = useTournaments();
  const upcomingTournaments = [...tournaments]
    .filter((tournament) => tournament.status !== "CANCELLED")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 4);
  const activeMatches = matches.filter(
    (match) => match.status === "LIVE" || match.status === "PAUSED",
  );
  const finishedMatches = matches.filter((match) => match.status === "FINISHED");
  const nextMatches = [...matches]
    .filter((match) => match.status !== "CANCELLED")
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    .slice(0, 4);
  const confirmedTeams = teams.filter((team) => team.status === "CONFIRMED");
  const teamsWithEnoughPlayers = teams.filter(
    (team) => players.filter((player) => player.teamId === team.id).length >= 3,
  );
  const nextTournament = upcomingTournaments[0];

  return (
    <>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">
            Organizer dashboard
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">
            Pregled turnira
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md bg-[#F97316] px-4 text-sm font-bold text-[#111827] transition hover:bg-[#FACC15]"
            href="/tournaments"
          >
            Novi turnir
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
            href="/live-score"
          >
            Otvori live score
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
            href="/standings"
          >
            Tabele
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
            href="/player-stats"
          >
            Statistika
          </Link>
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={
            nextTournament
              ? `Sledeci: ${formatDate(nextTournament.startDate)}`
              : "Napravi prvi turnir"
          }
          label="Turniri"
          tone="orange"
          value={tournaments.length.toString()}
        />
        <MetricCard
          detail={`${confirmedTeams.length} potvrdjenih ekipa`}
          label="Ekipe"
          tone="green"
          value={teams.length.toString()}
        />
        <MetricCard
          detail={`${teamsWithEnoughPlayers.length} ekipa ima 3+ igraca`}
          label="Igraci"
          tone="yellow"
          value={players.length.toString()}
        />
        <MetricCard
          detail={`${finishedMatches.length} zavrsenih / ${activeMatches.length} live`}
          label="Utakmice"
          tone="blue"
          value={matches.length.toString()}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-normal">
                Moji turniri
              </h3>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Stvarni turniri, kapacitet i popunjenost ekipama.
              </p>
            </div>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-white/15 px-3 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
              href="/tournaments"
            >
              Upravljaj
            </Link>
          </div>

          {upcomingTournaments.length === 0 ? (
            <EmptyState
              actionHref="/tournaments"
              actionText="Napravi turnir"
              text="Kada napravis turnir, ovde ce se pojaviti datumi, kapacitet i status."
              title="Jos nema turnira"
            />
          ) : (
            <div className="mt-5 grid gap-3" data-testid="dashboard-tournaments">
              {upcomingTournaments.map((tournament) => (
                <TournamentRow
                  key={tournament.id}
                  teamCount={
                    teams.filter((team) => team.tournamentId === tournament.id)
                      .length
                  }
                  tournament={tournament}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold tracking-normal">
                Sledeci koraci
              </h3>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Dashboard sada prikazuje spremnost sistema.
              </p>
            </div>
            <span className="rounded-md bg-[#F97316]/15 px-2 py-1 text-xs font-black text-[#FACC15]">
              MVP
            </span>
          </div>

          <div className="mt-5 space-y-3">
            <ChecklistItem
              done={tournaments.length > 0}
              text="Kreiran bar jedan turnir"
            />
            <ChecklistItem
              done={teams.length > 0}
              text="Dodate ekipe za turnir"
            />
            <ChecklistItem
              done={players.length > 0}
              text="Dodati igraci u ekipe"
            />
            <ChecklistItem
              done={matches.length > 0}
              text="Kreiran raspored utakmica"
            />
            <ChecklistItem
              done={finishedMatches.length > 0}
              text="Tabela ima zavrsen rezultat"
            />
            <ChecklistItem
              done={
                activeMatches.length > 0 ||
                finishedMatches.length > 0
              }
              text="Live score povezan sa utakmicom"
            />
            <ChecklistItem
              done={tournaments.some((tournament) => tournament.registrationOpen)}
              text="Otvorene prijave za neki turnir"
            />
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ReadinessPanel
          description={
            tournaments.length > 0
              ? "Turnirski podaci su povezani sa ekipama, rosterima i rasporedom."
              : "Prvi realan podatak koji treba uneti je turnir."
          }
          title="Turnirski setup"
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <SmallMetric label="Draft" value={countStatus(tournaments, "DRAFT")} />
            <SmallMetric
              label="Ekipe"
              value={teams.length}
            />
            <SmallMetric
              label="Roster ready"
              value={teamsWithEnoughPlayers.length}
            />
            <SmallMetric label="Odigrano" value={finishedMatches.length} />
          </div>
        </ReadinessPanel>

        <ReadinessPanel
          description="Zakazane utakmice se otvaraju direktno u live score-u, a rezultat se vraca u raspored."
          title="Raspored i rezultati"
        >
          {nextMatches.length === 0 ? (
            <EmptyState
              actionHref="/matches"
              actionText="Zakazi utakmicu"
              text="Jos nema utakmica u sistemu."
              title="Nema zakazanih meceva"
            />
          ) : (
            <div className="grid gap-3">
              {nextMatches.map((match) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  teamAName={getTeamName(match.teamAId, teams)}
                  teamBName={getTeamName(match.teamBId, teams)}
                />
              ))}
            </div>
          )}
        </ReadinessPanel>
      </div>
    </>
  );
}

function MetricCard({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: "blue" | "green" | "orange" | "yellow";
  value: string;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[#94A3B8]">{label}</p>
        <span className={`h-3 w-3 rounded-full ${toneClassName(tone)}`} />
      </div>
      <p className="mt-4 text-4xl font-black tracking-normal">{value}</p>
      <p className="mt-2 text-sm text-[#CBD5E1]">{detail}</p>
    </article>
  );
}

function TournamentRow({
  teamCount,
  tournament,
}: {
  teamCount: number;
  tournament: Tournament;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#0F172A] p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <span
            className={`rounded-md px-2 py-1 text-xs font-black ${statusStyles[tournament.status]}`}
          >
            {statusLabels[tournament.status]}
          </span>
          <h4 className="mt-3 truncate text-xl font-black text-white">
            {tournament.name}
          </h4>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {tournament.city}, {tournament.country} / {tournament.location}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 md:w-[300px]">
          <SmallMetric label="Datum" value={formatDate(tournament.startDate)} />
          <SmallMetric label="Tereni" value={tournament.numberOfCourts} />
          <SmallMetric label="Ekipe" value={`${teamCount}/${tournament.maxTeams}`} />
        </div>
      </div>
    </article>
  );
}

function MatchRow({
  match,
  teamAName,
  teamBName,
}: {
  match: Match;
  teamAName: string;
  teamBName: string;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#0F172A] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className={`rounded-md px-2 py-1 text-xs font-black ${matchStatusStyles[match.status]}`}>
            {matchStatusLabels[match.status]}
          </span>
          <h4 className="mt-3 text-lg font-black text-white">
            {teamAName} vs {teamBName}
          </h4>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {match.courtName} / {formatDateTime(match.scheduledTime)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-[220px]">
          <SmallMetric label="Score" value={`${match.scoreA}:${match.scoreB}`} />
          <Link
            className="inline-flex min-h-[58px] items-center justify-center rounded-md bg-[#F97316] px-3 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
            href={`/live-score?matchId=${match.id}`}
          >
            Live
          </Link>
        </div>
      </div>
    </article>
  );
}

function ChecklistItem({ done, text }: { done: boolean; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-white/10 bg-[#0F172A] px-3 py-3">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-black ${
          done ? "bg-[#22C55E] text-[#052E16]" : "bg-white/10 text-[#94A3B8]"
        }`}
      >
        {done ? "OK" : "-"}
      </span>
      <p className="text-sm font-semibold text-[#CBD5E1]">{text}</p>
    </div>
  );
}

function ReadinessPanel({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
      <h3 className="text-xl font-bold tracking-normal">{title}</h3>
      <p className="mt-1 text-sm text-[#94A3B8]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
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
  actionHref?: string;
  actionText?: string;
  text: string;
  title: string;
}) {
  return (
    <div className="mt-5 rounded-lg border border-dashed border-white/15 bg-[#0F172A] p-6 text-center">
      <p className="text-lg font-bold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#94A3B8]">{text}</p>
      {actionHref && actionText && (
        <Link
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#F97316] px-3 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
          href={actionHref}
        >
          {actionText}
        </Link>
      )}
    </div>
  );
}

function countStatus(tournaments: Tournament[], status: TournamentStatus) {
  return tournaments.filter((tournament) => tournament.status === status).length;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function formatDateTime(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function getTeamName(teamId: string, teams: Team[]) {
  return teams.find((team) => team.id === teamId)?.name ?? "Nepoznata ekipa";
}

function toneClassName(tone: "blue" | "green" | "orange" | "yellow") {
  const tones = {
    blue: "bg-[#38BDF8]",
    green: "bg-[#22C55E]",
    orange: "bg-[#F97316]",
    yellow: "bg-[#FACC15]",
  };

  return tones[tone];
}
