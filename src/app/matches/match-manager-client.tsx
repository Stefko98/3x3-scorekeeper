"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { confirmDelete } from "../lib/confirm-delete";
import { createId } from "../lib/id";
import { saveMatchEvents, useMatchEvents } from "../live-score/match-event-store";
import { usePlayers } from "../players/player-store";
import { useTeams, type Team } from "../teams/team-store";
import {
  getEnabledMatchPhases,
  getTournamentFormat,
} from "../tournaments/tournament-format";
import { useTournaments, type Tournament } from "../tournaments/tournament-store";
import {
  buildAutomaticGroupMatchPlan,
  getAutomaticGroupMatchId,
  getGroupMatchSections,
} from "./auto-group-matches";
import {
  buildAutomaticKnockoutPlan,
  buildKnockoutMatchesFromPlan,
  ensureAutomaticKnockout,
} from "./auto-knockout";
import { AutomaticGroupMatchesPanel } from "./automatic-group-matches-panel";
import { AutomaticKnockoutPanel } from "./automatic-knockout-panel";
import { KnockoutBracket } from "./knockout-bracket";
import {
  applyKnockoutProgression,
  canStartKnockoutMatch,
} from "./knockout-utils";
import {
  getMatchPhase,
  matchPhaseLabels,
  saveMatches,
  useMatches,
  type Match,
  type MatchPhase,
  type MatchStatus,
} from "./match-store";

type MatchFormState = {
  courtName: string;
  matchPhase: MatchPhase;
  scheduledTime: string;
  teamAId: string;
  teamBId: string;
};

type FormErrors = Partial<Record<keyof MatchFormState | "tournament", string>>;

const defaultFormState: MatchFormState = {
  courtName: "Kos 1",
  matchPhase: "GROUP_STAGE",
  scheduledTime: getDateTimeInputValue(),
  teamAId: "",
  teamBId: "",
};

const matchStatusLabels: Record<MatchStatus, string> = {
  CANCELLED: "Otkazana",
  FINISHED: "Završena",
  LIVE: "Uživo",
  PAUSED: "Pauza",
  SCHEDULED: "Zakazana",
};

export function MatchManagerClient() {
  const matchEvents = useMatchEvents();
  const matches = useMatches();
  const players = usePlayers();
  const teams = useTeams();
  const tournaments = useTournaments();
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState<MatchFormState>(defaultFormState);
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
  const tournamentFormat = getTournamentFormat(
    selectedTournament,
    tournamentTeams.length,
  );
  const schedulePhases = getEnabledMatchPhases(tournamentFormat);
  const phaseOptions = getPhaseOptions(schedulePhases);
  const automaticGroupMatchPlan = useMemo(
    () =>
      selectedTournament
        ? buildAutomaticGroupMatchPlan({
            matches,
            teams: tournamentTeams,
            tournamentId: selectedTournament.id,
          })
        : undefined,
    [matches, selectedTournament, tournamentTeams],
  );
  const automaticKnockoutPlan = useMemo(
    () =>
      selectedTournament
        ? buildAutomaticKnockoutPlan({
            matches,
            teams: tournamentTeams,
            tournament: selectedTournament,
            tournamentId: selectedTournament.id,
          })
        : undefined,
    [matches, selectedTournament, tournamentTeams],
  );
  const selectedTeamAId = tournamentTeams.some(
    (team) => team.id === form.teamAId,
  )
    ? form.teamAId
    : tournamentTeams[0]?.id ?? "";
  const selectedTeamBId =
    tournamentTeams.some((team) => team.id === form.teamBId) &&
    form.teamBId !== selectedTeamAId
      ? form.teamBId
      : tournamentTeams.find((team) => team.id !== selectedTeamAId)?.id ?? "";

  const metrics = useMemo(
    () => ({
      finished: tournamentMatches.filter((match) => match.status === "FINISHED")
        .length,
      live: tournamentMatches.filter(
        (match) => match.status === "LIVE" || match.status === "PAUSED",
      ).length,
      scheduled: tournamentMatches.filter(
        (match) => match.status === "SCHEDULED",
      ).length,
      total: tournamentMatches.length,
    }),
    [tournamentMatches],
  );

  useEffect(() => {
    if (
      !selectedTournament ||
      (!automaticKnockoutPlan?.canCreate && !automaticKnockoutPlan?.canReplace)
    ) {
      return;
    }

    const nextMatches = ensureAutomaticKnockout({
      matches,
      teams,
      tournament: selectedTournament,
      tournamentId: selectedTournament.id,
    });

    if (nextMatches !== matches) {
      saveMatches(nextMatches);
    }
  }, [automaticKnockoutPlan, matches, selectedTournament, teams]);

  function updateField<K extends keyof MatchFormState>(
    field: K,
    value: MatchFormState[K],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }

  function createMatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const effectiveForm = {
      ...form,
      teamAId: selectedTeamAId,
      teamBId: selectedTeamBId,
    };
    const nextErrors = validateForm(
      effectiveForm,
      selectedTournament,
      tournamentTeams,
    );
    setErrors(nextErrors);

    if (!selectedTournament || Object.keys(nextErrors).length > 0) {
      return;
    }

    const now = new Date().toISOString();
    const match: Match = {
      courtName: getInternalBasketName(
        effectiveForm.matchPhase,
        effectiveForm.teamAId,
        effectiveForm.teamBId,
        tournamentTeams,
      ),
      createdAt: now,
      foulsA: 0,
      foulsB: 0,
      id: createId("match"),
      matchPhase: effectiveForm.matchPhase,
      scheduledTime: effectiveForm.scheduledTime,
      scoreA: 0,
      scoreB: 0,
      status: "SCHEDULED",
      teamAId: effectiveForm.teamAId,
      teamBId: effectiveForm.teamBId,
      tournamentId: selectedTournament.id,
      updatedAt: now,
    };

    saveMatches([match, ...matches]);
    setForm((currentForm) => ({
      ...currentForm,
      matchPhase: defaultFormState.matchPhase,
      scheduledTime: getDateTimeInputValue(),
    }));
    setErrors({});
  }

  function updateMatchStatus(matchId: string, status: MatchStatus) {
    const targetMatch = matches.find((match) => match.id === matchId);

    if (
      status === "LIVE" &&
      (!targetMatch || !canStartKnockoutMatch(matches, matchId))
    ) {
      return;
    }

    if (
      status === "FINISHED" &&
      (!targetMatch ||
        targetMatch.scoreA === targetMatch.scoreB ||
        (Math.max(targetMatch.scoreA, targetMatch.scoreB) < 21 &&
          targetMatch.clockRemainingSeconds !== 0))
    ) {
      return;
    }

    const now = new Date().toISOString();

    const nextMatches = matches.map((match) =>
        match.id === matchId
          ? {
              ...match,
              finishedAt: status === "FINISHED" ? now : match.finishedAt,
              startedAt:
                status === "LIVE" && !match.startedAt ? now : match.startedAt,
              status,
              updatedAt: now,
              winnerTeamId:
                status === "FINISHED"
                  ? getWinnerTeamId(match)
                  : match.winnerTeamId,
            }
          : match,
    );

    if (status !== "FINISHED") {
      saveMatches(nextMatches);
      return;
    }

    const progressedMatches = applyKnockoutProgression(nextMatches, matchId);
    const finishedMatch = progressedMatches.find((match) => match.id === matchId);

    saveMatches(
      finishedMatch
        ? ensureAutomaticKnockout({
            matches: progressedMatches,
            teams,
            tournament: tournaments.find(
              (tournament) => tournament.id === finishedMatch.tournamentId,
            ),
            tournamentId: finishedMatch.tournamentId,
          })
        : progressedMatches,
    );
  }

  function deleteMatch(matchId: string) {
    if (!confirmDelete()) {
      return;
    }

    saveMatches(matches.filter((match) => match.id !== matchId));
    saveMatchEvents(matchEvents.filter((event) => event.matchId !== matchId));
  }

  function createAutomaticGroupMatches() {
    if (!selectedTournament || !automaticGroupMatchPlan?.canCreate) {
      return;
    }

    const now = new Date().toISOString();
    const groupMatches = automaticGroupMatchPlan.pairings.map(
      (pairing, index): Match => ({
        courtName: getInternalBasketNameForGroup(pairing.groupName),
        createdAt: new Date(Date.now() + index).toISOString(),
        foulsA: 0,
        foulsB: 0,
        id: getAutomaticGroupMatchId(
          selectedTournament.id,
          pairing.teamA.id,
          pairing.teamB.id,
        ),
        matchPhase: "GROUP_STAGE",
        scheduledTime: "",
        scoreA: 0,
        scoreB: 0,
        status: "SCHEDULED",
        teamAId: pairing.teamA.id,
        teamBId: pairing.teamB.id,
        tournamentId: selectedTournament.id,
        updatedAt: now,
      }),
    );

    saveMatches([...matches, ...groupMatches]);
  }

  function createAutomaticKnockout() {
    if (!selectedTournament || !automaticKnockoutPlan?.canCreate) {
      return;
    }

    const knockoutMatches = buildKnockoutMatchesFromPlan(
      automaticKnockoutPlan,
      selectedTournament.id,
    );
    saveMatches([...matches, ...knockoutMatches]);
  }

  function replaceAutomaticKnockout() {
    if (!selectedTournament || !automaticKnockoutPlan?.canReplace) {
      return;
    }

    const knockoutMatchIds = new Set(
      matches
        .filter(
          (match) =>
            match.tournamentId === selectedTournament.id &&
            getMatchPhase(match) !== "GROUP_STAGE",
        )
        .map((match) => match.id),
    );
    const knockoutMatches = buildKnockoutMatchesFromPlan(
      automaticKnockoutPlan,
      selectedTournament.id,
    );

    saveMatches([
      ...matches.filter((match) => !knockoutMatchIds.has(match.id)),
      ...knockoutMatches,
    ]);
    saveMatchEvents(
      matchEvents.filter((event) => !knockoutMatchIds.has(event.matchId)),
    );
  }

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">Raspored</p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">Utakmice</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Utakmice" value={metrics.total.toString()} />
          <Metric label="Zakazane" value={metrics.scheduled.toString()} />
          <Metric label="Uživo" value={metrics.live.toString()} />
          <Metric label="Završene" value={metrics.finished.toString()} />
        </div>
      </header>

      {tournaments.length === 0 ? (
        <EmptyState
          actionHref="/tournaments"
          actionText="Napravi turnir"
          text="Utakmiće se prave u okviru turnira."
          title="Prvo napravi turnir"
        />
      ) : tournamentTeams.length < 2 ? (
        <EmptyState
          actionHref="/teams"
          actionText="Dodaj ekipe"
          text="Za utakmicu su potrebne najmanje dve ekipe na istom turniru."
          title="Dodaj bar dve ekipe"
        />
      ) : (
        <div className="mt-6 grid gap-6 2xl:grid-cols-[400px_minmax(0,1fr)]">
          <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
            <div>
              <h3 className="text-xl font-bold tracking-normal">
                Nova utakmica
              </h3>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Zakaži utakmicu i posle je otvori u rezultatu uživo.
              </p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={createMatch}>
              <SelectField
                label="Turnir"
                name="match-tournament"
                onChange={setSelectedTournamentId}
                options={Object.fromEntries(
                  tournaments.map((tournament) => [
                    tournament.id,
                    tournament.name,
                  ]),
                )}
                value={selectedTournament?.id ?? ""}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Ekipa A"
                  name="match-team-a"
                  onChange={(value) => updateField("teamAId", value)}
                  options={Object.fromEntries(
                    tournamentTeams.map((team) => [team.id, team.name]),
                  )}
                  value={selectedTeamAId}
                />
                <SelectField
                  label="Ekipa B"
                  name="match-team-b"
                  onChange={(value) => updateField("teamBId", value)}
                  options={Object.fromEntries(
                    tournamentTeams.map((team) => [team.id, team.name]),
                  )}
                  value={selectedTeamBId}
                />
              </div>

              <TextField
                error={errors.scheduledTime}
                label="Vreme"
                name="match-time"
                onChange={(value) => updateField("scheduledTime", value)}
                type="datetime-local"
                value={form.scheduledTime}
              />

              <SelectField
                label="Faza utakmice"
                name="match-phase"
                onChange={(value) => updateField("matchPhase", value as MatchPhase)}
                options={phaseOptions}
                value={form.matchPhase}
              />

              {(errors.tournament || errors.teamAId || errors.teamBId) && (
                <p className="rounded-md border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2 text-sm font-semibold text-[#FCA5A5]">
                  {errors.tournament ?? errors.teamAId ?? errors.teamBId}
                </p>
              )}

              <button
                className="h-12 w-full rounded-md bg-[#F97316] px-4 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
                data-testid="create-match"
                type="submit"
              >
                Sačuvaj utakmicu
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-normal">Raspored</h3>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  {selectedTournament?.name ?? "Izaberi turnir"}
                </p>
              </div>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-white/15 px-3 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
                href="/live-score"
              >
                Rezultat uživo
              </Link>
            </div>

            {automaticGroupMatchPlan && (
              <AutomaticGroupMatchesPanel
                onCreate={createAutomaticGroupMatches}
                plan={automaticGroupMatchPlan}
              />
            )}

            {automaticKnockoutPlan && (
              <AutomaticKnockoutPanel
                onCreate={createAutomaticKnockout}
                onReplace={replaceAutomaticKnockout}
                plan={automaticKnockoutPlan}
              />
            )}

            {tournamentMatches.length === 0 ? (
              <EmptyState
                text="Kada zakažeš utakmicu, ovde ces dobiti direktan ulaz u rezultat uživo."
                title="Jos nema utakmica"
              />
            ) : (
              <div className="mt-5 grid gap-5" data-testid="match-list">
                {schedulePhases.map((phase) => (
                  <SchedulePhaseSection
                    key={phase}
                    matches={tournamentMatches}
                    onDelete={deleteMatch}
                    onStatusChange={updateMatchStatus}
                    phase={phase}
                    players={players}
                    teams={teams}
                  />
                ))}
                {selectedTournament && (
                  <KnockoutBracket
                    knockoutTeams={tournamentFormat.knockoutTeams}
                    matches={tournamentMatches}
                    teams={tournamentTeams}
                    tournamentId={selectedTournament.id}
                  />
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function getPhaseOptions(phases: MatchPhase[]) {
  return Object.fromEntries(
    phases.map((phase) => [phase, matchPhaseLabels[phase]]),
  ) as Record<MatchPhase, string>;
}

function SchedulePhaseSection({
  matches,
  onDelete,
  onStatusChange,
  phase,
  players,
  teams,
}: {
  matches: Match[];
  onDelete: (matchId: string) => void;
  onStatusChange: (matchId: string, status: MatchStatus) => void;
  phase: MatchPhase;
  players: ReturnType<typeof usePlayers>;
  teams: Team[];
}) {
  const phaseMatches = matches.filter((match) => getMatchPhase(match) === phase);
  const groupSections =
    phase === "GROUP_STAGE"
      ? getGroupMatchSections(phaseMatches, teams)
      : [];

  return (
    <section className="rounded-lg border border-white/10 bg-[#0F172A] p-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-black uppercase text-[#FACC15]">
          {matchPhaseLabels[phase]}
        </h4>
        <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-bold text-[#CBD5E1]">
          {phaseMatches.length}
        </span>
      </div>

      {phaseMatches.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-white/15 px-3 py-4 text-sm text-[#94A3B8]">
          Nema utakmica u ovoj fazi.
        </p>
      ) : phase === "GROUP_STAGE" ? (
        <div className="mt-4 grid gap-7">
          {groupSections.map((section) => (
            <div key={section.groupName}>
              <div className="flex items-center justify-between gap-3 border-b border-[#F97316]/35 pb-3">
                <h5 className="text-lg font-black text-white">
                  {section.groupName}
                </h5>
                <span className="rounded-md bg-[#F97316]/15 px-2 py-1 text-xs font-black text-[#FACC15]">
                  {section.matches.length} utakmica
                </span>
              </div>
              <div className="mt-4 grid gap-4">
                {section.matches.map((match, index) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                    playerCountA={
                      players.filter(
                        (player) => player.teamId === match.teamAId,
                      ).length
                    }
                    playerCountB={
                      players.filter(
                        (player) => player.teamId === match.teamBId,
                      ).length
                    }
                    scheduleNumber={index + 1}
                    teamA={teams.find((team) => team.id === match.teamAId)}
                    teamB={teams.find((team) => team.id === match.teamBId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 grid gap-4">
          {phaseMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              playerCountA={
                players.filter((player) => player.teamId === match.teamAId)
                  .length
              }
              playerCountB={
                players.filter((player) => player.teamId === match.teamBId)
                  .length
              }
              teamA={teams.find((team) => team.id === match.teamAId)}
              teamB={teams.find((team) => team.id === match.teamBId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MatchCard({
  match,
  onDelete,
  onStatusChange,
  playerCountA,
  playerCountB,
  scheduleNumber,
  teamA,
  teamB,
}: {
  match: Match;
  onDelete: (matchId: string) => void;
  onStatusChange: (matchId: string, status: MatchStatus) => void;
  playerCountA: number;
  playerCountB: number;
  scheduleNumber?: number;
  teamA?: Team;
  teamB?: Team;
}) {
  const matchIsReady = Boolean(teamA && teamB && match.teamAId && match.teamBId);

  return (
    <article
      className="rounded-lg border border-white/10 bg-[#0F172A] p-4"
      data-testid="match-card"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-1 text-xs font-black ${statusBadge(match.status)}`}>
              {matchStatusLabels[match.status]}
            </span>
            {scheduleNumber && (
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-bold text-[#CBD5E1]">
                Utakmica {scheduleNumber}
              </span>
            )}
          </div>
          <h4 className="mt-3 text-xl font-black tracking-normal text-white">
            {teamA?.name ?? "Ekipa A"} protiv {teamB?.name ?? "Ekipa B"}
          </h4>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {formatDateTime(match.scheduledTime)} / {matchPhaseLabels[getMatchPhase(match)]}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Metric label="Rezultat" value={`${match.scoreA}:${match.scoreB}`} />
          <SelectField
            compact
            label="Status"
            name={`match-status-${match.id}`}
            onChange={(value) => onStatusChange(match.id, value as MatchStatus)}
            options={matchStatusLabels}
            value={match.status}
          />
          {matchIsReady ? (
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#F97316] px-3 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
              href={`/live-score?matchId=${match.id}`}
            >
              Otvori
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-[#94A3B8]">
              Čeka ekipe
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Metric label="Faulovi" value={`${match.foulsA}:${match.foulsB}`} />
        <Metric label="Igrači A" value={playerCountA.toString()} />
        <Metric label="Igrači B" value={playerCountB.toString()} />
        <button
          className="h-[58px] rounded-md border border-[#EF4444]/60 px-3 text-sm font-bold text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white"
          onClick={() => onDelete(match.id)}
          type="button"
        >
          Obriši
        </button>
      </div>
    </article>
  );
}

function TextField({
  error,
  label,
  name,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  error?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "datetime-local" | "text";
  value: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-[#CBD5E1]" htmlFor={name}>
        {label}
      </label>
      <input
        className={`mt-2 h-11 w-full rounded-md border bg-[#0F172A] px-3 text-sm text-white outline-none transition placeholder:text-[#64748B] focus:border-[#F97316] ${
          error ? "border-[#EF4444]" : "border-white/10"
        }`}
        data-testid={`field-${name}`}
        id={name}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {error && <p className="mt-1 text-xs font-semibold text-[#FCA5A5]">{error}</p>}
    </div>
  );
}

function SelectField<T extends string>({
  compact = false,
  label,
  name,
  onChange,
  options,
  value,
}: {
  compact?: boolean;
  label: string;
  name: string;
  onChange: (value: T) => void;
  options: Record<T, string>;
  value: T;
}) {
  return (
    <label className="block">
      {!compact && (
        <span className="text-sm font-semibold text-[#CBD5E1]">{label}</span>
      )}
      <select
        aria-label={compact ? label : undefined}
        className={`w-full rounded-md border border-white/10 bg-[#0F172A] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#F97316] ${
          compact ? "h-10" : "mt-2 h-11"
        }`}
        name={name}
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {(Object.entries(options) as Array<[T, string]>).map(
          ([optionValue, labelText]) => (
            <option key={optionValue} value={optionValue}>
              {labelText}
            </option>
          ),
        )}
      </select>
    </label>
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
  actionHref?: string;
  actionText?: string;
  text: string;
  title: string;
}) {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-white/15 bg-[#111827] p-6 text-center">
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

function validateForm(
  form: MatchFormState,
  selectedTournament: Tournament | undefined,
  tournamentTeams: Team[],
) {
  const errors: FormErrors = {};

  if (!selectedTournament) {
    errors.tournament = "Izaberi turnir.";
  }

  if (tournamentTeams.length < 2) {
    errors.tournament = "Potrebne su najmanje dve ekipe.";
  }

  if (!form.teamAId) {
    errors.teamAId = "Izaberi ekipu A.";
  }

  if (!form.teamBId) {
    errors.teamBId = "Izaberi ekipu B.";
  }

  if (form.teamAId && form.teamBId && form.teamAId === form.teamBId) {
    errors.teamBId = "Ekipe moraju biti razlicite.";
  }

  if (!form.scheduledTime) {
    errors.scheduledTime = "Vreme je obavezno.";
  }

  return errors;
}

function getInternalBasketName(
  phase: MatchPhase,
  teamAId: string,
  teamBId: string,
  teams: Team[],
) {
  if (phase !== "GROUP_STAGE") {
    return "Kos 1";
  }

  const teamA = teams.find((team) => team.id === teamAId);
  const teamB = teams.find((team) => team.id === teamBId);

  if (teamA?.groupName && teamA.groupName === teamB?.groupName) {
    return getInternalBasketNameForGroup(`Grupa ${teamA.groupName}`);
  }

  return "Kos 1";
}

function getInternalBasketNameForGroup(groupName: string) {
  const normalizedGroup = groupName.toLowerCase();

  if (normalizedGroup.includes("grupa b")) {
    return "Kos 2";
  }

  return "Kos 1";
}

function getWinnerTeamId(match: Match) {
  if (match.scoreA === match.scoreB) {
    return undefined;
  }

  return match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
}

function getDateTimeInputValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

  return date.toISOString().slice(0, 16);
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

function statusBadge(status: MatchStatus) {
  const classes: Record<MatchStatus, string> = {
    CANCELLED: "bg-white/10 text-[#CBD5E1]",
    FINISHED: "bg-[#38BDF8]/15 text-[#7DD3FC]",
    LIVE: "bg-[#22C55E]/15 text-[#86EFAC]",
    PAUSED: "bg-[#FACC15]/15 text-[#FDE68A]",
    SCHEDULED: "bg-[#F97316]/15 text-[#FDBA74]",
  };

  return classes[status];
}
