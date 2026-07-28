"use client";

import { useMemo, useState } from "react";
import { KnockoutBracket } from "../matches/knockout-bracket";
import {
  getMatchPhase,
  matchPhaseLabels,
  useMatches,
  type Match,
  type MatchPhase,
  type MatchStatus,
} from "../matches/match-store";
import { useTeams, type Team } from "../teams/team-store";
import {
  getEnabledMatchPhases,
  getTournamentFormat,
} from "../tournaments/tournament-format";
import { useTournaments } from "../tournaments/tournament-store";

const matchStatusLabels: Record<MatchStatus, string> = {
  CANCELLED: "Otkazana",
  FINISHED: "Završena",
  LIVE: "Uživo",
  PAUSED: "Pauza",
  SCHEDULED: "Zakazana",
};

const matchStatusStyles: Record<MatchStatus, string> = {
  CANCELLED: "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#FCA5A5]",
  FINISHED: "border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#7DD3FC]",
  LIVE: "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#86EFAC]",
  PAUSED: "border-[#FACC15]/35 bg-[#FACC15]/12 text-[#FDE68A]",
  SCHEDULED: "border-white/10 bg-white/[0.04] text-[#CBD5E1]",
};

export function PublicViewClient() {
  const matches = useMatches();
  const teams = useTeams();
  const tournaments = useTournaments();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>();

  const selectedTournament =
    tournaments.find((tournament) => tournament.id === selectedTournamentId) ??
    tournaments[0];
  const tournamentMatches = useMemo(
    () =>
      selectedTournament
        ? matches.filter((match) => match.tournamentId === selectedTournament.id)
        : [],
    [matches, selectedTournament],
  );
  const tournamentTeams = useMemo(
    () =>
      selectedTournament
        ? teams.filter((team) => team.tournamentId === selectedTournament.id)
        : [],
    [teams, selectedTournament],
  );
  const tournamentFormat = getTournamentFormat(
    selectedTournament,
    tournamentTeams.length,
  );
  const publicPhases = getEnabledMatchPhases(tournamentFormat);
  const liveMatches = tournamentMatches.filter(
    (match) => match.status === "LIVE" || match.status === "PAUSED",
  );
  const finishedMatches = tournamentMatches.filter(
    (match) => match.status === "FINISHED",
  );

  return (
    <div>
      <header className="border-b border-white/10 pb-5">
        <p className="text-sm font-medium text-[#94A3B8]">
          Samo prikaz, bez unosa
        </p>
        <h2 className="mt-1 text-3xl font-bold tracking-normal">
          Javni prikaz rezultata
        </h2>
      </header>

      {tournaments.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-white/15 bg-[#111827] p-6 text-center text-sm text-[#94A3B8]">
          Nema turnira za javni prikaz.
        </p>
      ) : (
        <div className="mt-6 grid gap-6">
          <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
              <div>
                <label
                  className="text-sm font-semibold text-[#CBD5E1]"
                  htmlFor="public-tournament"
                >
                  Turnir
                </label>
                <select
                  className="mt-2 h-12 w-full rounded-md border border-white/10 bg-[#0F172A] px-3 text-base font-bold text-white outline-none transition focus:border-[#F97316]"
                  id="public-tournament"
                  onChange={(event) =>
                    setSelectedTournamentId(event.target.value)
                  }
                  value={selectedTournament?.id ?? ""}
                >
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Metric label="Uživo" value={liveMatches.length.toString()} />
                <Metric
                  label="Završeno"
                  value={finishedMatches.length.toString()}
                />
                <Metric
                  label="Ukupno"
                  value={tournamentMatches.length.toString()}
                />
              </div>
            </div>
          </section>

          {liveMatches.length > 0 && (
            <section className="rounded-lg border border-[#22C55E]/25 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-normal text-[#86EFAC]">
                    Sada se igra
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-white">
                    Rezultat uživo
                  </h3>
                </div>
                <span className="w-fit rounded-md border border-[#22C55E]/30 bg-[#22C55E]/10 px-3 py-1 text-sm font-black text-[#86EFAC]">
                  {liveMatches.length} aktivno
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {liveMatches.map((match) => (
                  <PublicMatchCard
                    highlight
                    key={match.id}
                    match={match}
                    teams={tournamentTeams}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-5">
            {publicPhases.map((phase) => (
              <PublicPhaseSection
                key={phase}
                matches={tournamentMatches}
                phase={phase}
                teams={tournamentTeams}
              />
            ))}
          </section>

          {selectedTournament && (
            <KnockoutBracket
              knockoutTeams={tournamentFormat.knockoutTeams}
              matches={tournamentMatches}
              showMatchLinks={false}
              teams={tournamentTeams}
              tournamentId={selectedTournament.id}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PublicPhaseSection({
  matches,
  phase,
  teams,
}: {
  matches: Match[];
  phase: MatchPhase;
  teams: Team[];
}) {
  const phaseMatches = matches.filter((match) => getMatchPhase(match) === phase);

  return (
    <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.2)] sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-normal text-[#FACC15]">
            Faza turnira
          </p>
          <h3 className="mt-1 text-2xl font-black text-white">
            {matchPhaseLabels[phase]}
          </h3>
        </div>
        <span className="w-fit rounded-md bg-[#F97316]/15 px-3 py-1 text-sm font-black text-[#FDBA74]">
          {phaseMatches.length} utakmica
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {phaseMatches.length === 0 ? (
          <p className="rounded-md border border-dashed border-white/15 bg-[#0F172A] px-4 py-6 text-center text-sm text-[#94A3B8] md:col-span-2 2xl:col-span-3">
            Nema utakmica u ovoj fazi.
          </p>
        ) : (
          phaseMatches.map((match) => (
            <PublicMatchCard
              key={match.id}
              match={match}
              showOutcomeLabels={phase !== "GROUP_STAGE"}
              teams={teams}
            />
          ))
        )}
      </div>
    </section>
  );
}

function PublicMatchCard({
  highlight = false,
  match,
  showOutcomeLabels = true,
  teams,
}: {
  highlight?: boolean;
  match: Match;
  showOutcomeLabels?: boolean;
  teams: Team[];
}) {
  const teamAName = getTeamName(match.teamAId, teams);
  const teamBName = getTeamName(match.teamBId, teams);
  const winnerTeamId = getWinnerTeamId(match);

  return (
    <article
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-[#22C55E]/35 bg-[#0B1F1A]"
          : "border-white/10 bg-[#0F172A]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`rounded-md border px-2 py-1 text-xs font-black ${matchStatusStyles[match.status]}`}
        >
          {matchStatusLabels[match.status]}
        </span>
        <span className="text-xs font-semibold text-[#94A3B8]">
          {formatMatchTime(match.scheduledTime)}
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        <PublicTeamResult
          isLoser={Boolean(
            winnerTeamId && match.teamAId && winnerTeamId !== match.teamAId,
          )}
          isWinner={winnerTeamId === match.teamAId}
          name={teamAName}
          score={match.scoreA}
          showOutcomeLabel={showOutcomeLabels}
        />
        <PublicTeamResult
          isLoser={Boolean(
            winnerTeamId && match.teamBId && winnerTeamId !== match.teamBId,
          )}
          isWinner={winnerTeamId === match.teamBId}
          name={teamBName}
          score={match.scoreB}
          showOutcomeLabel={showOutcomeLabels}
        />
      </div>
    </article>
  );
}

function PublicTeamResult({
  isLoser,
  isWinner,
  name,
  score,
  showOutcomeLabel,
}: {
  isLoser: boolean;
  isWinner: boolean;
  name: string;
  score: number;
  showOutcomeLabel: boolean;
}) {
  return (
    <div
      className={`flex min-h-16 items-center justify-between gap-3 rounded-md border px-4 py-3 ${
        isWinner
          ? "border-[#22C55E]/45 bg-[#22C55E]/12"
          : isLoser
            ? "border-[#EF4444]/35 bg-[#EF4444]/10"
            : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="min-w-0">
        <p
          className={`truncate text-lg font-black ${
            isWinner ? "text-[#86EFAC]" : "text-white"
          }`}
        >
          {name}
        </p>
        {showOutcomeLabel && (isWinner || isLoser) && (
          <p
            className={`mt-1 text-xs font-bold ${
              isWinner ? "text-[#86EFAC]" : "text-[#FCA5A5]"
            }`}
          >
            {isWinner ? "Prosao" : "Ispao"}
          </p>
        )}
      </div>
      <p
        className={`shrink-0 text-3xl font-black ${
          isWinner ? "text-[#86EFAC]" : isLoser ? "text-[#FCA5A5]" : "text-white"
        }`}
      >
        {score}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0F172A] px-3 py-2">
      <p className="text-xs text-[#94A3B8]">{label}</p>
      <p className="mt-1 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function getWinnerTeamId(match: Match) {
  if (match.winnerTeamId) {
    return match.winnerTeamId;
  }

  if (match.status !== "FINISHED" || match.scoreA === match.scoreB) {
    return undefined;
  }

  return match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
}

function getTeamName(teamId: string, teams: Team[]) {
  if (!teamId) {
    return "Čeka protivnika";
  }

  return teams.find((team) => team.id === teamId)?.name ?? "Nepoznata ekipa";
}

function formatMatchTime(value: string) {
  if (!value) {
    return "Bez termina";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}
