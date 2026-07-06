"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { saveMatchEvents, useMatchEvents } from "../live-score/match-event-store";
import { usePlayers } from "../players/player-store";
import { useTeams, type Team } from "../teams/team-store";
import { useTournaments, type Tournament } from "../tournaments/tournament-store";
import {
  saveMatches,
  useMatches,
  type Match,
  type MatchStatus,
  type MatchType,
} from "./match-store";

type MatchFormState = {
  courtName: string;
  matchType: MatchType;
  scheduledTime: string;
  teamAId: string;
  teamBId: string;
};

type FormErrors = Partial<Record<keyof MatchFormState | "tournament", string>>;

const defaultFormState: MatchFormState = {
  courtName: "Court 1",
  matchType: "GROUP_MATCH",
  scheduledTime: getDateTimeInputValue(),
  teamAId: "",
  teamBId: "",
};

const matchTypeLabels: Record<MatchType, string> = {
  FINAL: "Final",
  FRIENDLY: "Friendly",
  GROUP_MATCH: "Group match",
  QUARTER_FINAL: "Quarter final",
  SEMI_FINAL: "Semi final",
  THIRD_PLACE: "Third place",
};

const matchStatusLabels: Record<MatchStatus, string> = {
  CANCELLED: "Cancelled",
  FINISHED: "Finished",
  LIVE: "Live",
  PAUSED: "Paused",
  SCHEDULED: "Scheduled",
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
      courtName: form.courtName.trim(),
      createdAt: now,
      foulsA: 0,
      foulsB: 0,
      id: crypto.randomUUID(),
      matchType: effectiveForm.matchType,
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
      courtName: defaultFormState.courtName,
      matchType: defaultFormState.matchType,
      scheduledTime: getDateTimeInputValue(),
    }));
    setErrors({});
  }

  function updateMatchStatus(matchId: string, status: MatchStatus) {
    const now = new Date().toISOString();

    saveMatches(
      matches.map((match) =>
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
      ),
    );
  }

  function deleteMatch(matchId: string) {
    saveMatches(matches.filter((match) => match.id !== matchId));
    saveMatchEvents(matchEvents.filter((event) => event.matchId !== matchId));
  }

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">Schedule</p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">Utakmice</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Utakmice" value={metrics.total.toString()} />
          <Metric label="Scheduled" value={metrics.scheduled.toString()} />
          <Metric label="Live" value={metrics.live.toString()} />
          <Metric label="Finished" value={metrics.finished.toString()} />
        </div>
      </header>

      {tournaments.length === 0 ? (
        <EmptyState
          actionHref="/tournaments"
          actionText="Napravi turnir"
          text="Utakmice se prave u okviru turnira."
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
        <div className="mt-6 grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
            <div>
              <h3 className="text-xl font-bold tracking-normal">
                Nova utakmica
              </h3>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Zakazi mec i posle ga otvori u live score-u.
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
                  label="Team A"
                  name="match-team-a"
                  onChange={(value) => updateField("teamAId", value)}
                  options={Object.fromEntries(
                    tournamentTeams.map((team) => [team.id, team.name]),
                  )}
                  value={selectedTeamAId}
                />
                <SelectField
                  label="Team B"
                  name="match-team-b"
                  onChange={(value) => updateField("teamBId", value)}
                  options={Object.fromEntries(
                    tournamentTeams.map((team) => [team.id, team.name]),
                  )}
                  value={selectedTeamBId}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  error={errors.courtName}
                  label="Teren"
                  name="match-court"
                  onChange={(value) => updateField("courtName", value)}
                  placeholder="Court 1"
                  value={form.courtName}
                />
                <TextField
                  error={errors.scheduledTime}
                  label="Vreme"
                  name="match-time"
                  onChange={(value) => updateField("scheduledTime", value)}
                  type="datetime-local"
                  value={form.scheduledTime}
                />
              </div>

              <SelectField
                label="Tip utakmice"
                name="match-type"
                onChange={(value) => updateField("matchType", value as MatchType)}
                options={matchTypeLabels}
                value={form.matchType}
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
                Sacuvaj utakmicu
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
                Live score
              </Link>
            </div>

            {tournamentMatches.length === 0 ? (
              <EmptyState
                text="Kada zakazes utakmicu, ovde ces dobiti direktan ulaz u live score."
                title="Jos nema utakmica"
              />
            ) : (
              <div className="mt-5 grid gap-4" data-testid="match-list">
                {tournamentMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onDelete={deleteMatch}
                    onStatusChange={updateMatchStatus}
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
        </div>
      )}
    </div>
  );
}

function MatchCard({
  match,
  onDelete,
  onStatusChange,
  playerCountA,
  playerCountB,
  teamA,
  teamB,
}: {
  match: Match;
  onDelete: (matchId: string) => void;
  onStatusChange: (matchId: string, status: MatchStatus) => void;
  playerCountA: number;
  playerCountB: number;
  teamA?: Team;
  teamB?: Team;
}) {
  return (
    <article
      className="rounded-lg border border-white/10 bg-[#0F172A] p-4"
      data-testid="match-card"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0">
          <span className={`rounded-md px-2 py-1 text-xs font-black ${statusBadge(match.status)}`}>
            {matchStatusLabels[match.status]}
          </span>
          <h4 className="mt-3 text-xl font-black tracking-normal text-white">
            {teamA?.name ?? "Team A"} vs {teamB?.name ?? "Team B"}
          </h4>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {match.courtName} / {formatDateTime(match.scheduledTime)} /{" "}
            {matchTypeLabels[match.matchType]}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Metric label="Score" value={`${match.scoreA}:${match.scoreB}`} />
          <SelectField
            compact
            label="Status"
            name={`match-status-${match.id}`}
            onChange={(value) => onStatusChange(match.id, value as MatchStatus)}
            options={matchStatusLabels}
            value={match.status}
          />
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#F97316] px-3 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
            href={`/live-score?matchId=${match.id}`}
          >
            Otvori
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Metric label="Faulovi" value={`${match.foulsA}:${match.foulsB}`} />
        <Metric label="A roster" value={playerCountA.toString()} />
        <Metric label="B roster" value={playerCountB.toString()} />
        <button
          className="h-[58px] rounded-md border border-[#EF4444]/60 px-3 text-sm font-bold text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white"
          onClick={() => onDelete(match.id)}
          type="button"
        >
          Obrisi
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
    errors.teamAId = "Izaberi Team A.";
  }

  if (!form.teamBId) {
    errors.teamBId = "Izaberi Team B.";
  }

  if (form.teamAId && form.teamBId && form.teamAId === form.teamBId) {
    errors.teamBId = "Ekipe moraju biti razlicite.";
  }

  if (!form.courtName.trim()) {
    errors.courtName = "Teren je obavezan.";
  }

  if (!form.scheduledTime) {
    errors.scheduledTime = "Vreme je obavezno.";
  }

  return errors;
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
