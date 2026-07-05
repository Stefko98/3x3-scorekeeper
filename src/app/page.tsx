import Link from "next/link";
import { AppShell } from "./app-shell";
import {
  liveMatch,
  schedule,
  standings,
  stats,
  type PlayerLine,
  type StatCard,
  type StatusTone,
  type TeamLine,
} from "./dashboard-data";

export default function Home() {
  return (
    <AppShell activeModule="Dashboard">
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
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <LiveScorePanel />
        <div className="grid gap-6">
          <SchedulePanel />
          <StandingsPanel />
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ stat }: { stat: StatCard }) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[#94A3B8]">{stat.label}</p>
        <span
          className={`h-3 w-3 rounded-full ${toneClassName(stat.tone, "dot")}`}
        />
      </div>
      <p className="mt-4 text-4xl font-black tracking-normal">{stat.value}</p>
      <p className="mt-2 text-sm text-[#CBD5E1]">{stat.detail}</p>
    </article>
  );
}

function LiveScorePanel() {
  const { teamA, teamB } = liveMatch;

  return (
    <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#22C55E]/15 px-2 py-1 text-xs font-black text-[#22C55E]">
              {liveMatch.status}
            </span>
            <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-semibold text-[#CBD5E1]">
              {liveMatch.court}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-bold tracking-normal">
            {liveMatch.tournament}
          </h3>
        </div>
        <div className="rounded-lg border border-[#F97316]/30 bg-[#0F172A] px-5 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
            Clock
          </p>
          <p className="mt-1 text-3xl font-black text-[#FACC15]">
            {liveMatch.clock}
          </p>
        </div>
      </div>

      <div className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)]">
        <TeamPanel side="A" team={teamA} />

        <div className="flex items-center justify-center rounded-lg border border-[#F97316]/30 bg-[#0F172A] px-4 py-5">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
              Score
            </p>
            <p className="mt-2 text-5xl font-black tracking-normal text-white">
              {teamA.score}
              <span className="mx-2 text-[#F97316]">:</span>
              {teamB.score}
            </p>
            <p className="mt-3 text-xs font-semibold text-[#CBD5E1]">
              Fouls {teamA.fouls}:{teamB.fouls}
            </p>
          </div>
        </div>

        <TeamPanel side="B" team={teamB} />
      </div>

      <div className="grid gap-4 border-t border-white/10 pt-4 lg:grid-cols-[1fr_220px]">
        <div className="grid gap-2 sm:grid-cols-3">
          <button className="h-11 rounded-md bg-[#F97316] text-sm font-black text-[#111827] transition hover:bg-[#FACC15]">
            Start
          </button>
          <button className="h-11 rounded-md border border-white/15 text-sm font-black text-white transition hover:border-[#FACC15] hover:text-[#FACC15]">
            Pause
          </button>
          <button className="h-11 rounded-md border border-[#EF4444]/60 text-sm font-black text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white">
            Finish
          </button>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#0F172A] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
            Event log
          </p>
          <div className="mt-3 space-y-2">
            {liveMatch.events.map((event) => (
              <p className="text-xs font-medium text-[#CBD5E1]" key={event}>
                {event}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TeamPanel({ side, team }: { side: "A" | "B"; team: TeamLine }) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#0F172A] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-[#F97316]">Team {side}</p>
          <h4 className="mt-1 text-lg font-bold tracking-normal">
            {team.name}
          </h4>
          <p className="text-sm text-[#94A3B8]">{team.city}</p>
        </div>
        <div className="rounded-md bg-white/5 px-3 py-2 text-center">
          <p className="text-xs text-[#94A3B8]">Fouls</p>
          <p className="text-lg font-black text-[#FACC15]">{team.fouls}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {team.players.map((player) => (
          <PlayerRow key={player.number} player={player} />
        ))}
      </div>
    </article>
  );
}

function PlayerRow({ player }: { player: PlayerLine }) {
  return (
    <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-white/[0.04] px-3 py-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F97316]/15 text-sm font-black text-[#FACC15]">
        #{player.number}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">
          {player.name}
        </p>
        <p className="text-xs text-[#94A3B8]">Fouls {player.fouls}</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-black text-white">{player.points}</p>
        <p className="text-xs text-[#94A3B8]">pts</p>
      </div>
    </div>
  );
}

function SchedulePanel() {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold tracking-normal">Raspored</h3>
        <span className="text-xs font-semibold text-[#FACC15]">Danas</span>
      </div>
      <div className="mt-4 space-y-3">
        {schedule.map((item) => (
          <article
            className="rounded-md border border-white/10 bg-[#0F172A] p-3"
            key={`${item.time}-${item.match}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">{item.match}</p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  {item.phase} / {item.court}
                </p>
              </div>
              <time className="rounded-md bg-white/5 px-2 py-1 text-sm font-black text-[#FACC15]">
                {item.time}
              </time>
            </div>
            <p className="mt-2 text-xs font-semibold text-[#CBD5E1]">
              {item.status}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function StandingsPanel() {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold tracking-normal">Tabela grupe A</h3>
        <span className="text-xs font-semibold text-[#94A3B8]">Auto</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.12em] text-[#94A3B8]">
            <tr>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Team</th>
              <th className="px-3 py-3 text-right">W-L</th>
              <th className="px-3 py-3 text-right">Pts</th>
              <th className="px-3 py-3 text-right">+/-</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {standings.map((row) => (
              <tr className="bg-[#0F172A]" key={row.team}>
                <td className="px-3 py-3 font-black text-[#FACC15]">
                  {row.rank}
                </td>
                <td className="px-3 py-3 font-semibold text-white">
                  {row.team}
                </td>
                <td className="px-3 py-3 text-right text-[#CBD5E1]">
                  {row.wins}-{row.losses}
                </td>
                <td className="px-3 py-3 text-right text-[#CBD5E1]">
                  {row.points}
                </td>
                <td className="px-3 py-3 text-right font-bold text-[#22C55E]">
                  {row.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function toneClassName(tone: StatusTone, element: "dot") {
  const tones: Record<StatusTone, Record<typeof element, string>> = {
    green: { dot: "bg-[#22C55E]" },
    orange: { dot: "bg-[#F97316]" },
    yellow: { dot: "bg-[#FACC15]" },
    red: { dot: "bg-[#EF4444]" },
    blue: { dot: "bg-[#38BDF8]" },
  };

  return tones[tone][element];
}
