"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { confirmDelete } from "../lib/confirm-delete";
import { createId } from "../lib/id";
import { saveMatchEvents, useMatchEvents } from "../live-score/match-event-store";
import { saveMatches, useMatches } from "../matches/match-store";
import { savePlayers, usePlayers } from "../players/player-store";
import { getTournamentFormat } from "../tournaments/tournament-format";
import { useTournaments, type Tournament } from "../tournaments/tournament-store";
import { saveTeams, useTeams, type Team, type TeamStatus } from "./team-store";

type TeamFormState = {
  captainPhone: string;
  city: string;
  groupName: string;
  logoUrl: string;
  name: string;
  status: TeamStatus;
};

type FormErrors = Partial<Record<keyof TeamFormState | "tournament", string>>;

const defaultFormState: TeamFormState = {
  captainPhone: "",
  city: "",
  groupName: "",
  logoUrl: "",
  name: "",
  status: "CONFIRMED",
};

const teamStatusLabels: Record<TeamStatus, string> = {
  CONFIRMED: "Potvrdjena",
  DISQUALIFIED: "Diskvalifikovana",
  REGISTERED: "Prijavljena",
  WITHDRAWN: "Odustala",
};

export function TeamManagerClient() {
  const matchEvents = useMatchEvents();
  const matches = useMatches();
  const players = usePlayers();
  const teams = useTeams();
  const tournaments = useTournaments();
  const [editingTeamId, setEditingTeamId] = useState<string>();
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState<TeamFormState>(defaultFormState);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>();

  const selectedTournament =
    tournaments.find((tournament) => tournament.id === selectedTournamentId) ??
    tournaments[0];
  const groupOptions = useMemo(
    () =>
      selectedTournament
        ? getGroupOptions(getTournamentFormat(selectedTournament).groupCount)
        : {},
    [selectedTournament],
  );
  const allowedGroupNames = useMemo(() => Object.keys(groupOptions), [groupOptions]);
  const groupSelectOptions = useMemo(
    () => ({ "": "Bez grupe", ...groupOptions }),
    [groupOptions],
  );
  const selectedGroupName =
    allowedGroupNames.length > 0
      ? normalizeGroupNameForOptions(form.groupName, allowedGroupNames)
      : form.groupName;
  const tournamentTeams = useMemo(
    () =>
      selectedTournament
        ? teams.filter((team) => team.tournamentId === selectedTournament.id)
        : [],
    [selectedTournament, teams],
  );

  const metrics = useMemo(
    () => ({
      players: tournamentTeams.reduce(
        (total, team) =>
          total + players.filter((player) => player.teamId === team.id).length,
        0,
      ),
      total: tournamentTeams.length,
    }),
    [players, tournamentTeams],
  );

  function updateField<K extends keyof TeamFormState>(
    field: K,
    value: TeamFormState[K],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }

  function changeTournament(tournamentId: string) {
    setSelectedTournamentId(tournamentId);
    setEditingTeamId(undefined);
    setForm(defaultFormState);
    setErrors({});
  }

  function saveTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedForm = {
      ...form,
      groupName: selectedGroupName,
    };
    const nextErrors = validateForm(
      normalizedForm,
      selectedTournament,
      tournamentTeams,
      allowedGroupNames,
      editingTeamId,
    );
    setErrors(nextErrors);

    if (!selectedTournament || Object.keys(nextErrors).length > 0) {
      return;
    }

    const now = new Date().toISOString();

    if (editingTeamId) {
      saveTeams(
        teams.map((team) =>
          team.id === editingTeamId
            ? {
                ...team,
                captainPhone: normalizedForm.captainPhone.trim(),
                city: normalizedForm.city.trim(),
                groupName: normalizedForm.groupName.trim().toUpperCase(),
                logoUrl: normalizedForm.logoUrl.trim(),
                name: normalizedForm.name.trim(),
                status: normalizedForm.status,
                updatedAt: now,
              }
            : team,
        ),
      );
      resetForm();
      return;
    }

    const team: Team = {
      captainPhone: normalizedForm.captainPhone.trim(),
      city: normalizedForm.city.trim(),
      createdAt: now,
      groupName: normalizedForm.groupName.trim().toUpperCase(),
      id: createId("team"),
      logoUrl: normalizedForm.logoUrl.trim(),
      name: normalizedForm.name.trim(),
      status: normalizedForm.status,
      tournamentId: selectedTournament.id,
      updatedAt: now,
    };

    saveTeams([team, ...teams]);
    resetForm();
  }

  function startEditTeam(team: Team) {
    setEditingTeamId(team.id);
    setSelectedTournamentId(team.tournamentId);
    setForm({
      captainPhone: team.captainPhone,
      city: team.city,
      groupName: team.groupName,
      logoUrl: team.logoUrl,
      name: team.name,
      status: team.status,
    });
    setErrors({});
  }

  function resetForm() {
    setEditingTeamId(undefined);
    setForm(defaultFormState);
    setErrors({});
  }

  function deleteTeam(teamId: string) {
    if (!confirmDelete()) {
      return;
    }

    const deletedMatchIds = new Set(
      matches
        .filter((match) => match.teamAId === teamId || match.teamBId === teamId)
        .map((match) => match.id),
    );

    saveTeams(teams.filter((team) => team.id !== teamId));
    savePlayers(players.filter((player) => player.teamId !== teamId));
    saveMatches(
      matches.filter(
        (match) => match.teamAId !== teamId && match.teamBId !== teamId,
      ),
    );
    saveMatchEvents(
      matchEvents.filter((event) => !deletedMatchIds.has(event.matchId)),
    );

    if (editingTeamId === teamId) {
      resetForm();
    }
  }

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">
            Ručno dodavanje ekipa
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">Ekipe</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Ekipe" value={metrics.total.toString()} />
          <Metric label="Igrači" value={metrics.players.toString()} />
          <Metric
            label="Kapacitet"
            value={
              selectedTournament
                ? `${metrics.total}/${selectedTournament.maxTeams}`
                : "0/0"
            }
          />
        </div>
      </header>

      {tournaments.length === 0 ? (
        <EmptyState
          actionHref="/tournaments"
          actionText="Napravi turnir"
          text="Ekipe se dodaju tek kada postoji turnir."
          title="Prvo napravi turnir"
        />
      ) : (
        <div className="mt-6 grid gap-6 2xl:grid-cols-[400px_minmax(0,1fr)]">
          <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
            <div>
              <h3 className="text-xl font-bold tracking-normal">
                {editingTeamId ? "Izmena ekipe" : "Nova ekipa"}
              </h3>
              <p className="mt-1 text-sm text-[#94A3B8]">
                {editingTeamId
                  ? "Izmeni podatke i sačuvaj promene."
                  : "Svaka ekipa je vezana za izabrani turnir."}
              </p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={saveTeam}>
              <SelectField
                label="Turnir"
                name="tournament"
                onChange={changeTournament}
                options={Object.fromEntries(
                  tournaments.map((tournament) => [
                    tournament.id,
                    tournament.name,
                  ]),
                )}
                value={selectedTournament?.id ?? ""}
              />

              <TextField
                error={errors.name}
                label="Naziv ekipe"
                name="team-name"
                onChange={(value) => updateField("name", value)}
                placeholder="Beograd 3x3"
                value={form.name}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  error={errors.city}
                  label="Grad"
                  name="team-city"
                  onChange={(value) => updateField("city", value)}
                  placeholder="Beograd"
                  value={form.city}
                />
                <SelectField
                  error={errors.groupName}
                  label="Grupa"
                  name="team-group"
                  onChange={(value) => updateField("groupName", value)}
                  options={groupSelectOptions}
                  value={selectedGroupName}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Broj kapitena"
                  name="team-captain-phone"
                  onChange={(value) => updateField("captainPhone", value)}
                  placeholder="+381..."
                  value={form.captainPhone}
                />
                <TextField
                  label="Logo URL"
                  name="team-logo-url"
                  onChange={(value) => updateField("logoUrl", value)}
                  placeholder="https://..."
                  value={form.logoUrl}
                />
              </div>

              <SelectField
                label="Status ekipe"
                name="team-status"
                onChange={(value) => updateField("status", value as TeamStatus)}
                options={teamStatusLabels}
                value={form.status}
              />

              {errors.tournament && (
                <p className="rounded-md border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2 text-sm font-semibold text-[#FCA5A5]">
                  {errors.tournament}
                </p>
              )}

              <button
                className="h-12 w-full rounded-md bg-[#F97316] px-4 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
                data-testid="create-team"
                type="submit"
              >
                {editingTeamId ? "Sačuvaj izmene" : "Sačuvaj ekipu"}
              </button>
              {editingTeamId && (
                <button
                  className="h-11 w-full rounded-md border border-white/15 px-4 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
                  onClick={resetForm}
                  type="button"
                >
                  Odustani
                </button>
              )}
            </form>
          </section>

          <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-normal">
                  Ekipe za turnir
                </h3>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  {selectedTournament?.name ?? "Izaberi turnir"}
                </p>
              </div>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-white/15 px-3 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
                href="/players"
              >
                Dodaj igrače
              </Link>
            </div>

            {tournamentTeams.length === 0 ? (
              <EmptyState
                text="Kada dodas ekipu, pojaviće se ovde i biće dostupna za igrače i utakmice."
                title="Jos nema ekipa"
              />
            ) : (
              <div className="mt-5 grid gap-4" data-testid="team-list">
                {tournamentTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    onDelete={deleteTeam}
                    onEdit={startEditTeam}
                    playerCount={
                      players.filter((player) => player.teamId === team.id)
                        .length
                    }
                    team={team}
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

function TeamCard({
  onDelete,
  onEdit,
  playerCount,
  team,
}: {
  onDelete: (teamId: string) => void;
  onEdit: (team: Team) => void;
  playerCount: number;
  team: Team;
}) {
  return (
    <article
      className="rounded-lg border border-white/10 bg-[#0F172A] p-4"
      data-testid="team-card"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="min-w-0">
          <h4 className="mt-3 text-xl font-black tracking-normal text-white">
            {team.name}
          </h4>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {team.city}
            {team.groupName ? ` / Grupa ${team.groupName}` : " / Bez grupe"}
          </p>
          {team.captainPhone && (
            <p className="mt-2 text-sm text-[#CBD5E1]">
              Broj kapitena: {team.captainPhone}
            </p>
          )}
          <span className="mt-3 inline-flex rounded-md bg-white/5 px-2 py-1 text-xs font-black text-[#FACC15]">
            {teamStatusLabels[team.status]}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Metric label="Igrači" value={playerCount.toString()} />
          <button
            className="h-10 rounded-md border border-white/15 px-3 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
            onClick={() => onEdit(team)}
            type="button"
          >
            Izmeni
          </button>
          <button
            className="h-10 rounded-md border border-[#EF4444]/60 px-3 text-sm font-bold text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white sm:col-span-2"
            onClick={() => onDelete(team.id)}
            type="button"
          >
            Obriši
          </button>
        </div>
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
  type?: "text";
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
  error,
  label,
  name,
  onChange,
  options,
  value,
}: {
  compact?: boolean;
  error?: string;
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
        className={`w-full rounded-md border bg-[#0F172A] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#F97316] ${
          error ? "border-[#EF4444]" : "border-white/10"
        } ${
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
      {error && <p className="mt-1 text-xs font-semibold text-[#FCA5A5]">{error}</p>}
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

function validateForm(
  form: TeamFormState,
  selectedTournament: Tournament | undefined,
  tournamentTeams: Team[],
  allowedGroupNames: string[],
  editingTeamId?: string,
) {
  const errors: FormErrors = {};

  if (!selectedTournament) {
    errors.tournament = "Izaberi turnir.";
  } else if (!editingTeamId && tournamentTeams.length >= selectedTournament.maxTeams) {
    errors.tournament = "Turnir je popunio maksimalan broj ekipa.";
  }

  if (!form.name.trim()) {
    errors.name = "Naziv ekipe je obavezan.";
  } else if (
    tournamentTeams.some(
      (team) =>
        team.id !== editingTeamId &&
        team.name.toLowerCase() === form.name.trim().toLowerCase(),
    )
  ) {
    errors.name = "Ekipa sa tim nazivom već postoji na turniru.";
  }

  if (!form.city.trim()) {
    errors.city = "Grad je obavezan.";
  }

  const groupName = form.groupName.trim().toUpperCase();

  if (
    selectedTournament &&
    groupName &&
    allowedGroupNames.length > 0 &&
    !allowedGroupNames.includes(groupName)
  ) {
    errors.groupName = `Grupa može biti samo ${formatGroupList(allowedGroupNames)}.`;
  }

  return errors;
}

function getGroupOptions(groupCount: number) {
  const safeGroupCount = Math.max(1, Math.min(8, Math.trunc(groupCount)));

  return Object.fromEntries(
    Array.from({ length: safeGroupCount }, (_, index) => {
      const groupName = String.fromCharCode(65 + index);

      return [groupName, `Grupa ${groupName}`];
    }),
  );
}

function normalizeGroupNameForOptions(value: string, groupOptions: string[]) {
  const normalizedGroupName = value.trim().toUpperCase();

  if (!normalizedGroupName) {
    return "";
  }

  if (groupOptions.includes(normalizedGroupName)) {
    return normalizedGroupName;
  }

  return "";
}

function formatGroupList(groupNames: string[]) {
  if (groupNames.length <= 2) {
    return groupNames.join(" ili ");
  }

  return `${groupNames.slice(0, -1).join(", ")} ili ${
    groupNames[groupNames.length - 1]
  }`;
}
