"use client";

import { useMemo, useState } from "react";
import { saveMatchEvents, useMatchEvents } from "../live-score/match-event-store";
import { saveMatches, useMatches } from "../matches/match-store";
import { savePlayers, usePlayers } from "../players/player-store";
import { saveTeams, useTeams } from "../teams/team-store";
import {
  saveTournaments,
  useTournaments,
  type Tournament,
  type TournamentStatus,
  type TournamentType,
} from "./tournament-store";

type TournamentFormState = {
  name: string;
  description: string;
  location: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  numberOfCourts: string;
  maxTeams: string;
  status: TournamentStatus;
  tournamentType: TournamentType;
  registrationOpen: boolean;
};

type FormErrors = Partial<Record<keyof TournamentFormState, string>>;

const defaultFormState: TournamentFormState = {
  name: "",
  description: "",
  location: "",
  city: "",
  country: "Serbia",
  startDate: getTodayInputValue(),
  endDate: getTodayInputValue(),
  numberOfCourts: "1",
  maxTeams: "16",
  status: "DRAFT",
  tournamentType: "GROUPS_AND_KNOCKOUT",
  registrationOpen: false,
};

const statusLabels: Record<TournamentStatus, string> = {
  DRAFT: "Draft",
  REGISTRATION_OPEN: "Registration open",
  REGISTRATION_CLOSED: "Registration closed",
  ONGOING: "Ongoing",
  FINISHED: "Finished",
  CANCELLED: "Cancelled",
};

const typeLabels: Record<TournamentType, string> = {
  GROUP_STAGE: "Group stage",
  KNOCKOUT: "Knockout",
  GROUPS_AND_KNOCKOUT: "Groups + knockout",
  LEAGUE: "League",
};

export function TournamentManagerClient() {
  const matchEvents = useMatchEvents();
  const matches = useMatches();
  const players = usePlayers();
  const teams = useTeams();
  const tournaments = useTournaments();
  const [form, setForm] = useState<TournamentFormState>(defaultFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>();

  const selectedTournament =
    tournaments.find((tournament) => tournament.id === selectedTournamentId) ??
    tournaments[0];

  const metrics = useMemo(() => {
    const liveCount = tournaments.filter(
      (tournament) => tournament.status === "ONGOING",
    ).length;
    const registrationCount = tournaments.filter(
      (tournament) => tournament.registrationOpen,
    ).length;
    const capacity = tournaments.reduce(
      (total, tournament) => total + tournament.maxTeams,
      0,
    );

    return {
      capacity,
      liveCount,
      registrationCount,
      tournamentCount: tournaments.length,
    };
  }, [tournaments]);

  function updateField<K extends keyof TournamentFormState>(
    field: K,
    value: TournamentFormState[K],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }

  function createTournament(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const now = new Date().toISOString();
    const tournament: Tournament = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      numberOfCourts: Number(form.numberOfCourts),
      maxTeams: Number(form.maxTeams),
      status: form.status,
      tournamentType: form.tournamentType,
      registrationOpen: form.registrationOpen,
      publicSlug: createUniqueSlug(form.name, tournaments),
      createdAt: now,
      updatedAt: now,
    };

    saveTournaments([tournament, ...tournaments]);
    setSelectedTournamentId(tournament.id);
    setForm(defaultFormState);
    setErrors({});
  }

  function updateTournamentStatus(
    tournamentId: string,
    status: TournamentStatus,
  ) {
    const nextTournaments = tournaments.map((tournament) =>
      tournament.id === tournamentId
        ? {
            ...tournament,
            status,
            registrationOpen:
              status === "REGISTRATION_OPEN"
                ? true
                : status === "REGISTRATION_CLOSED" || status === "ONGOING"
                  ? false
                  : tournament.registrationOpen,
            updatedAt: new Date().toISOString(),
          }
        : tournament,
    );

    saveTournaments(nextTournaments);
  }

  function toggleRegistration(tournamentId: string) {
    const nextTournaments = tournaments.map((tournament) =>
      tournament.id === tournamentId
        ? toggleTournamentRegistration(tournament)
        : tournament,
    );

    saveTournaments(nextTournaments);
  }

  function deleteTournament(tournamentId: string) {
    const deletedTeamIds = new Set(
      teams
        .filter((team) => team.tournamentId === tournamentId)
        .map((team) => team.id),
    );
    const deletedMatchIds = new Set(
      matches
        .filter((match) => match.tournamentId === tournamentId)
        .map((match) => match.id),
    );
    const nextTournaments = tournaments.filter(
      (tournament) => tournament.id !== tournamentId,
    );

    saveTournaments(nextTournaments);
    saveTeams(teams.filter((team) => team.tournamentId !== tournamentId));
    savePlayers(
      players.filter((player) => !deletedTeamIds.has(player.teamId)),
    );
    saveMatches(matches.filter((match) => match.tournamentId !== tournamentId));
    saveMatchEvents(
      matchEvents.filter((event) => !deletedMatchIds.has(event.matchId)),
    );

    if (selectedTournamentId === tournamentId) {
      setSelectedTournamentId(nextTournaments[0]?.id);
    }
  }

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">
            Organizer workspace
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">Turniri</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Turniri" value={metrics.tournamentCount.toString()} />
          <Metric label="Live" value={metrics.liveCount.toString()} />
          <Metric
            label="Prijave"
            value={metrics.registrationCount.toString()}
          />
          <Metric label="Kapacitet" value={metrics.capacity.toString()} />
        </div>
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
        <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
          <div>
            <h3 className="text-xl font-bold tracking-normal">Novi turnir</h3>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Osnovni podaci za prvi organizatorski korak.
            </p>
          </div>

          <form className="mt-5 space-y-4" onSubmit={createTournament}>
            <TextField
              error={errors.name}
              label="Naziv turnira"
              name="name"
              onChange={(value) => updateField("name", value)}
              placeholder="Belgrade Summer 3x3"
              value={form.name}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                error={errors.city}
                label="Grad"
                name="city"
                onChange={(value) => updateField("city", value)}
                placeholder="Belgrade"
                value={form.city}
              />
              <TextField
                error={errors.country}
                label="Drzava"
                name="country"
                onChange={(value) => updateField("country", value)}
                placeholder="Serbia"
                value={form.country}
              />
            </div>

            <TextField
              error={errors.location}
              label="Lokacija"
              name="location"
              onChange={(value) => updateField("location", value)}
              placeholder="Ada Ciganlija, Court 1"
              value={form.location}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                error={errors.startDate}
                label="Datum pocetka"
                name="startDate"
                onChange={(value) => updateField("startDate", value)}
                type="date"
                value={form.startDate}
              />
              <TextField
                error={errors.endDate}
                label="Datum zavrsetka"
                name="endDate"
                onChange={(value) => updateField("endDate", value)}
                type="date"
                value={form.endDate}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                error={errors.numberOfCourts}
                label="Broj terena"
                min={1}
                name="numberOfCourts"
                onChange={(value) => updateField("numberOfCourts", value)}
                type="number"
                value={form.numberOfCourts}
              />
              <TextField
                error={errors.maxTeams}
                label="Maks. ekipa"
                min={2}
                name="maxTeams"
                onChange={(value) => updateField("maxTeams", value)}
                type="number"
                value={form.maxTeams}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Format"
                name="tournamentType"
                onChange={(value) =>
                  updateField("tournamentType", value as TournamentType)
                }
                options={typeLabels}
                value={form.tournamentType}
              />
              <SelectField
                label="Status"
                name="status"
                onChange={(value) =>
                  updateField("status", value as TournamentStatus)
                }
                options={statusLabels}
                value={form.status}
              />
            </div>

            <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-[#0F172A] px-3 py-3 text-sm font-semibold text-[#CBD5E1]">
              <span>Prijave otvorene</span>
              <input
                checked={form.registrationOpen}
                className="h-5 w-5 accent-[#F97316]"
                onChange={(event) =>
                  updateField("registrationOpen", event.target.checked)
                }
                type="checkbox"
              />
            </label>

            <div>
              <label
                className="text-sm font-semibold text-[#CBD5E1]"
                htmlFor="description"
              >
                Opis
              </label>
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-white/10 bg-[#0F172A] px-3 py-3 text-sm text-white outline-none transition placeholder:text-[#64748B] focus:border-[#F97316]"
                id="description"
                name="description"
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="Kratak opis turnira, pravila ili sponzora"
                value={form.description}
              />
            </div>

            <button
              className="h-12 w-full rounded-md bg-[#F97316] px-4 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
              data-testid="create-tournament"
              type="submit"
            >
              Sacuvaj turnir
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-normal">
                Moji turniri
              </h3>
              <p className="mt-1 text-sm text-[#94A3B8]">
                {selectedTournament
                  ? `Izabran: ${selectedTournament.name}`
                  : "Nema sacuvanih turnira."}
              </p>
            </div>
            {selectedTournament && (
              <span className="rounded-md bg-[#F97316]/15 px-3 py-2 text-xs font-black text-[#FACC15]">
                /tournament/{selectedTournament.publicSlug}
              </span>
            )}
          </div>

          {tournaments.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-white/15 bg-[#0F172A] p-6 text-center">
              <p className="text-lg font-bold text-white">
                Jos nema turnira
              </p>
              <p className="mt-2 text-sm text-[#94A3B8]">
                Popuni formu levo i prvi turnir ce se pojaviti ovde.
              </p>
            </div>
          ) : (
            <div
              className="mt-5 grid gap-4"
              data-testid="tournament-list"
            >
              {tournaments.map((tournament) => (
                <TournamentCard
                  isSelected={tournament.id === selectedTournament?.id}
                  key={tournament.id}
                  onDelete={deleteTournament}
                  onSelect={setSelectedTournamentId}
                  onStatusChange={updateTournamentStatus}
                  onToggleRegistration={toggleRegistration}
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
      </div>
    </div>
  );
}

function toggleTournamentRegistration(tournament: Tournament): Tournament {
  const registrationOpen = !tournament.registrationOpen;
  let status: TournamentStatus = tournament.status;

  if (registrationOpen) {
    status = "REGISTRATION_OPEN";
  } else if (tournament.status === "REGISTRATION_OPEN") {
    status = "REGISTRATION_CLOSED";
  }

  return {
    ...tournament,
    registrationOpen,
    status,
    updatedAt: new Date().toISOString(),
  };
}

function TournamentCard({
  isSelected,
  onDelete,
  onSelect,
  onStatusChange,
  onToggleRegistration,
  teamCount,
  tournament,
}: {
  isSelected: boolean;
  onDelete: (tournamentId: string) => void;
  onSelect: (tournamentId: string) => void;
  onStatusChange: (tournamentId: string, status: TournamentStatus) => void;
  onToggleRegistration: (tournamentId: string) => void;
  teamCount: number;
  tournament: Tournament;
}) {
  return (
    <article
      className={`rounded-lg border p-4 transition ${
        isSelected
          ? "border-[#F97316] bg-[#F97316]/10"
          : "border-white/10 bg-[#0F172A]"
      }`}
      data-testid="tournament-card"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <button
          className="min-w-0 text-left"
          onClick={() => onSelect(tournament.id)}
          type="button"
        >
          <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-black text-[#FACC15]">
            {statusLabels[tournament.status]}
          </span>
          <h4 className="mt-3 text-xl font-black tracking-normal text-white">
            {tournament.name}
          </h4>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {tournament.city}, {tournament.country} / {tournament.location}
          </p>
        </button>

        <div className="grid gap-2 sm:grid-cols-3 xl:w-[360px]">
          <SelectField
            compact
            label="Status"
            name={`status-${tournament.id}`}
            onChange={(value) =>
              onStatusChange(tournament.id, value as TournamentStatus)
            }
            options={statusLabels}
            value={tournament.status}
          />
          <button
            className={`h-10 rounded-md border px-3 text-sm font-bold transition ${
              tournament.registrationOpen
                ? "border-[#22C55E]/60 text-[#86EFAC] hover:bg-[#22C55E] hover:text-[#052E16]"
                : "border-white/15 text-[#CBD5E1] hover:border-[#FACC15] hover:text-[#FACC15]"
            }`}
            onClick={() => onToggleRegistration(tournament.id)}
            type="button"
          >
            {tournament.registrationOpen ? "Prijave ON" : "Prijave OFF"}
          </button>
          <button
            className="h-10 rounded-md border border-[#EF4444]/60 px-3 text-sm font-bold text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white"
            onClick={() => onDelete(tournament.id)}
            type="button"
          >
            Obrisi
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Metric label="Datum" value={formatDateRange(tournament)} />
        <Metric label="Format" value={typeLabels[tournament.tournamentType]} />
        <Metric label="Tereni" value={tournament.numberOfCourts.toString()} />
        <Metric label="Ekipe" value={`${teamCount}/${tournament.maxTeams}`} />
      </div>

      {tournament.description && (
        <p className="mt-4 rounded-md bg-white/[0.04] px-3 py-2 text-sm text-[#CBD5E1]">
          {tournament.description}
        </p>
      )}
    </article>
  );
}

function TextField({
  error,
  label,
  min,
  name,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  error?: string;
  label: string;
  min?: number;
  name: keyof TournamentFormState;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "date" | "number" | "text";
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
        min={min}
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

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-xs text-[#94A3B8]">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white">{value}</p>
    </div>
  );
}

function validateForm(form: TournamentFormState) {
  const errors: FormErrors = {};
  const courts = Number(form.numberOfCourts);
  const maxTeams = Number(form.maxTeams);

  if (!form.name.trim()) {
    errors.name = "Naziv je obavezan.";
  }

  if (!form.city.trim()) {
    errors.city = "Grad je obavezan.";
  }

  if (!form.country.trim()) {
    errors.country = "Drzava je obavezna.";
  }

  if (!form.location.trim()) {
    errors.location = "Lokacija je obavezna.";
  }

  if (!form.startDate) {
    errors.startDate = "Datum pocetka je obavezan.";
  }

  if (!form.endDate) {
    errors.endDate = "Datum zavrsetka je obavezan.";
  }

  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    errors.endDate = "Zavrsetak ne moze biti pre pocetka.";
  }

  if (!Number.isInteger(courts) || courts < 1) {
    errors.numberOfCourts = "Unesi bar 1 teren.";
  }

  if (!Number.isInteger(maxTeams) || maxTeams < 2) {
    errors.maxTeams = "Unesi bar 2 ekipe.";
  }

  return errors;
}

function createUniqueSlug(name: string, tournaments: Tournament[]) {
  const baseSlug = slugify(name) || "turnir";
  const usedSlugs = new Set(tournaments.map((tournament) => tournament.publicSlug));
  let nextSlug = baseSlug;
  let counter = 2;

  while (usedSlugs.has(nextSlug)) {
    nextSlug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return nextSlug;
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

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateRange(tournament: Tournament) {
  if (tournament.startDate === tournament.endDate) {
    return formatDate(tournament.startDate);
  }

  return `${formatDate(tournament.startDate)} - ${formatDate(tournament.endDate)}`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}
