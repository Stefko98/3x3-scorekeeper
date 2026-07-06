"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { saveMatchEvents, useMatchEvents } from "../live-score/match-event-store";
import { saveMatches, useMatches } from "../matches/match-store";
import { savePlayers, usePlayers } from "../players/player-store";
import { useTournaments, type Tournament } from "../tournaments/tournament-store";
import { saveTeams, useTeams, type Team, type TeamStatus } from "./team-store";

type TeamFormState = {
  city: string;
  contactEmail: string;
  contactPerson: string;
  contactPhone: string;
  groupName: string;
  name: string;
  status: TeamStatus;
};

type FormErrors = Partial<Record<keyof TeamFormState | "tournament", string>>;

const defaultFormState: TeamFormState = {
  city: "",
  contactEmail: "",
  contactPerson: "",
  contactPhone: "",
  groupName: "",
  name: "",
  status: "REGISTERED",
};

const statusLabels: Record<TeamStatus, string> = {
  CONFIRMED: "Confirmed",
  DISQUALIFIED: "Disqualified",
  REGISTERED: "Registered",
  WITHDRAWN: "Withdrawn",
};

export function TeamManagerClient() {
  const matchEvents = useMatchEvents();
  const matches = useMatches();
  const players = usePlayers();
  const teams = useTeams();
  const tournaments = useTournaments();
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState<TeamFormState>(defaultFormState);
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

  const metrics = useMemo(() => {
    const confirmed = tournamentTeams.filter(
      (team) => team.status === "CONFIRMED",
    ).length;
    const registered = tournamentTeams.filter(
      (team) => team.status === "REGISTERED",
    ).length;

    return {
      confirmed,
      registered,
      total: tournamentTeams.length,
    };
  }, [tournamentTeams]);

  function updateField<K extends keyof TeamFormState>(
    field: K,
    value: TeamFormState[K],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }

  function createTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(form, selectedTournament, tournamentTeams);
    setErrors(nextErrors);

    if (!selectedTournament || Object.keys(nextErrors).length > 0) {
      return;
    }

    const now = new Date().toISOString();
    const team: Team = {
      city: form.city.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPerson: form.contactPerson.trim(),
      contactPhone: form.contactPhone.trim(),
      createdAt: now,
      groupName: form.groupName.trim(),
      id: crypto.randomUUID(),
      name: form.name.trim(),
      status: form.status,
      tournamentId: selectedTournament.id,
      updatedAt: now,
    };

    saveTeams([team, ...teams]);
    setForm(defaultFormState);
    setErrors({});
  }

  function updateTeamStatus(teamId: string, status: TeamStatus) {
    saveTeams(
      teams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              status,
              updatedAt: new Date().toISOString(),
            }
          : team,
      ),
    );
  }

  function deleteTeam(teamId: string) {
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
  }

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">
            Team registration
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">Ekipe</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Ekipe" value={metrics.total.toString()} />
          <Metric label="Confirmed" value={metrics.confirmed.toString()} />
          <Metric label="Registered" value={metrics.registered.toString()} />
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
        <div className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
            <div>
              <h3 className="text-xl font-bold tracking-normal">Nova ekipa</h3>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Svaka ekipa je vezana za izabrani turnir.
              </p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={createTeam}>
              <SelectField
                label="Turnir"
                name="tournament"
                onChange={setSelectedTournamentId}
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
                placeholder="Belgrade Wolves"
                value={form.name}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  error={errors.city}
                  label="Grad"
                  name="team-city"
                  onChange={(value) => updateField("city", value)}
                  placeholder="Belgrade"
                  value={form.city}
                />
                <TextField
                  label="Grupa"
                  name="team-group"
                  onChange={(value) => updateField("groupName", value)}
                  placeholder="A"
                  value={form.groupName}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Kontakt osoba"
                  name="team-contact-person"
                  onChange={(value) => updateField("contactPerson", value)}
                  placeholder="Stefan"
                  value={form.contactPerson}
                />
                <TextField
                  label="Telefon"
                  name="team-contact-phone"
                  onChange={(value) => updateField("contactPhone", value)}
                  placeholder="+381..."
                  value={form.contactPhone}
                />
              </div>

              <TextField
                error={errors.contactEmail}
                label="Email"
                name="team-contact-email"
                onChange={(value) => updateField("contactEmail", value)}
                placeholder="ekipa@email.com"
                type="email"
                value={form.contactEmail}
              />

              <SelectField
                label="Status"
                name="team-status"
                onChange={(value) => updateField("status", value as TeamStatus)}
                options={statusLabels}
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
                Sacuvaj ekipu
              </button>
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
                Dodaj igrace
              </Link>
            </div>

            {tournamentTeams.length === 0 ? (
              <EmptyState
                text="Kada dodas ekipu, pojavice se ovde i bice dostupna za igrace i utakmice."
                title="Jos nema ekipa"
              />
            ) : (
              <div className="mt-5 grid gap-4" data-testid="team-list">
                {tournamentTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    onDelete={deleteTeam}
                    onStatusChange={updateTeamStatus}
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
  onStatusChange,
  playerCount,
  team,
}: {
  onDelete: (teamId: string) => void;
  onStatusChange: (teamId: string, status: TeamStatus) => void;
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
          <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-black text-[#FACC15]">
            {statusLabels[team.status]}
          </span>
          <h4 className="mt-3 text-xl font-black tracking-normal text-white">
            {team.name}
          </h4>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {team.city}
            {team.groupName ? ` / Grupa ${team.groupName}` : ""}
          </p>
          {(team.contactPerson || team.contactPhone || team.contactEmail) && (
            <p className="mt-2 text-sm text-[#CBD5E1]">
              {[team.contactPerson, team.contactPhone, team.contactEmail]
                .filter(Boolean)
                .join(" / ")}
            </p>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Metric label="Igraci" value={playerCount.toString()} />
          <SelectField
            compact
            label="Status"
            name={`status-${team.id}`}
            onChange={(value) => onStatusChange(team.id, value as TeamStatus)}
            options={statusLabels}
            value={team.status}
          />
          <button
            className="h-10 rounded-md border border-[#EF4444]/60 px-3 text-sm font-bold text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white"
            onClick={() => onDelete(team.id)}
            type="button"
          >
            Obrisi
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
  type?: "email" | "text";
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
) {
  const errors: FormErrors = {};

  if (!selectedTournament) {
    errors.tournament = "Izaberi turnir.";
  } else if (tournamentTeams.length >= selectedTournament.maxTeams) {
    errors.tournament = "Turnir je popunio maksimalan broj ekipa.";
  }

  if (!form.name.trim()) {
    errors.name = "Naziv ekipe je obavezan.";
  } else if (
    tournamentTeams.some(
      (team) => team.name.toLowerCase() === form.name.trim().toLowerCase(),
    )
  ) {
    errors.name = "Ekipa sa tim nazivom vec postoji na turniru.";
  }

  if (!form.city.trim()) {
    errors.city = "Grad je obavezan.";
  }

  if (form.contactEmail.trim() && !form.contactEmail.includes("@")) {
    errors.contactEmail = "Email nije ispravan.";
  }

  return errors;
}
