"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTeams, type Team } from "../teams/team-store";
import { useTournaments, type Tournament } from "../tournaments/tournament-store";
import {
  getPlayerDisplayName,
  savePlayers,
  usePlayers,
  type Player,
  type PlayerPosition,
} from "./player-store";

type PlayerFormState = {
  firstName: string;
  jerseyNumber: string;
  lastName: string;
  nickname: string;
  position: PlayerPosition;
  teamId: string;
};

type FormErrors = Partial<Record<keyof PlayerFormState | "tournament", string>>;

const defaultFormState: PlayerFormState = {
  firstName: "",
  jerseyNumber: "",
  lastName: "",
  nickname: "",
  position: "FLEX",
  teamId: "",
};

const positionLabels: Record<PlayerPosition, string> = {
  BIG: "Big",
  FLEX: "Flex",
  GUARD: "Guard",
  WING: "Wing",
};

export function PlayerManagerClient() {
  const players = usePlayers();
  const teams = useTeams();
  const tournaments = useTournaments();
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState<PlayerFormState>(defaultFormState);
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
  const tournamentPlayers = useMemo(
    () =>
      selectedTournament
        ? players.filter((player) => player.tournamentId === selectedTournament.id)
        : [],
    [players, selectedTournament],
  );

  const selectedTeam =
    tournamentTeams.find((team) => team.id === form.teamId) ??
    tournamentTeams[0];
  const selectedTeamPlayers = selectedTeam
    ? players.filter((player) => player.teamId === selectedTeam.id)
    : [];

  const metrics = useMemo(
    () => ({
      players: tournamentPlayers.length,
      teams: tournamentTeams.length,
      withoutRoster: tournamentTeams.filter(
        (team) => !players.some((player) => player.teamId === team.id),
      ).length,
      readyTeams: tournamentTeams.filter(
        (team) =>
          players.filter((player) => player.teamId === team.id).length >= 3,
      ).length,
    }),
    [players, tournamentPlayers.length, tournamentTeams],
  );

  function updateField<K extends keyof PlayerFormState>(
    field: K,
    value: PlayerFormState[K],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }

  function createPlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(
      form,
      selectedTournament,
      selectedTeam,
      selectedTeamPlayers,
    );
    setErrors(nextErrors);

    if (!selectedTournament || !selectedTeam || Object.keys(nextErrors).length > 0) {
      return;
    }

    const now = new Date().toISOString();
    const player: Player = {
      createdAt: now,
      firstName: form.firstName.trim(),
      id: crypto.randomUUID(),
      jerseyNumber: Number(form.jerseyNumber),
      lastName: form.lastName.trim(),
      nickname: form.nickname.trim(),
      position: form.position,
      teamId: selectedTeam.id,
      tournamentId: selectedTournament.id,
      updatedAt: now,
    };

    savePlayers([player, ...players]);
    setForm({
      ...defaultFormState,
      teamId: selectedTeam.id,
    });
    setErrors({});
  }

  function deletePlayer(playerId: string) {
    savePlayers(players.filter((player) => player.id !== playerId));
  }

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">Roster builder</p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">Igraci</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Igraci" value={metrics.players.toString()} />
          <Metric label="Ekipe" value={metrics.teams.toString()} />
          <Metric label="3+ igraca" value={metrics.readyTeams.toString()} />
          <Metric label="Bez rostera" value={metrics.withoutRoster.toString()} />
        </div>
      </header>

      {tournaments.length === 0 ? (
        <EmptyState
          actionHref="/tournaments"
          actionText="Napravi turnir"
          text="Igraci se dodaju u ekipe, a ekipe pripadaju turniru."
          title="Prvo napravi turnir"
        />
      ) : tournamentTeams.length === 0 ? (
        <EmptyState
          actionHref="/teams"
          actionText="Dodaj ekipe"
          text="Kada postoje ekipe, ovde pravis roster za svaku od njih."
          title="Prvo dodaj ekipe"
        />
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
            <div>
              <h3 className="text-xl font-bold tracking-normal">Novi igrac</h3>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Igrac se cuva u rosteru izabrane ekipe.
              </p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={createPlayer}>
              <SelectField
                label="Turnir"
                name="player-tournament"
                onChange={setSelectedTournamentId}
                options={Object.fromEntries(
                  tournaments.map((tournament) => [
                    tournament.id,
                    tournament.name,
                  ]),
                )}
                value={selectedTournament?.id ?? ""}
              />

              <SelectField
                label="Ekipa"
                name="player-team"
                onChange={(value) => updateField("teamId", value)}
                options={Object.fromEntries(
                  tournamentTeams.map((team) => [team.id, team.name]),
                )}
                value={selectedTeam?.id ?? ""}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  error={errors.firstName}
                  label="Ime"
                  name="player-first-name"
                  onChange={(value) => updateField("firstName", value)}
                  placeholder="Marko"
                  value={form.firstName}
                />
                <TextField
                  error={errors.lastName}
                  label="Prezime"
                  name="player-last-name"
                  onChange={(value) => updateField("lastName", value)}
                  placeholder="Markovic"
                  value={form.lastName}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  error={errors.jerseyNumber}
                  label="Broj dresa"
                  min={0}
                  name="player-jersey"
                  onChange={(value) => updateField("jerseyNumber", value)}
                  placeholder="7"
                  type="number"
                  value={form.jerseyNumber}
                />
                <SelectField
                  label="Pozicija"
                  name="player-position"
                  onChange={(value) =>
                    updateField("position", value as PlayerPosition)
                  }
                  options={positionLabels}
                  value={form.position}
                />
              </div>

              <TextField
                label="Nadimak"
                name="player-nickname"
                onChange={(value) => updateField("nickname", value)}
                placeholder="optional"
                value={form.nickname}
              />

              {errors.tournament && (
                <p className="rounded-md border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2 text-sm font-semibold text-[#FCA5A5]">
                  {errors.tournament}
                </p>
              )}

              <button
                className="h-12 w-full rounded-md bg-[#F97316] px-4 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
                data-testid="create-player"
                type="submit"
              >
                Sacuvaj igraca
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-normal">Rosteri</h3>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  {selectedTournament?.name ?? "Izaberi turnir"}
                </p>
              </div>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-white/15 px-3 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
                href="/matches"
              >
                Zakazi utakmice
              </Link>
            </div>

            <div className="mt-5 grid gap-4" data-testid="player-list">
              {tournamentTeams.map((team) => (
                <TeamRoster
                  key={team.id}
                  onDeletePlayer={deletePlayer}
                  players={players
                    .filter((player) => player.teamId === team.id)
                    .sort((a, b) => a.jerseyNumber - b.jerseyNumber)}
                  team={team}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function TeamRoster({
  onDeletePlayer,
  players,
  team,
}: {
  onDeletePlayer: (playerId: string) => void;
  players: Player[];
  team: Team;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#0F172A] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-lg font-black text-white">{team.name}</h4>
          <p className="text-sm text-[#94A3B8]">
            {team.city} / {players.length} igraca
          </p>
        </div>
        <span
          className={`rounded-md px-2 py-1 text-xs font-black ${
            players.length >= 3
              ? "bg-[#22C55E]/15 text-[#86EFAC]"
              : "bg-[#FACC15]/15 text-[#FDE68A]"
          }`}
        >
          {players.length >= 3 ? "Spremno" : "Dodaj jos"}
        </span>
      </div>

      {players.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-white/15 px-3 py-3 text-sm text-[#94A3B8]">
          Nema igraca u ovoj ekipi.
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          {players.map((player) => (
            <div
              className="grid gap-3 rounded-md border border-white/10 bg-[#111827] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              data-testid="player-card"
              key={player.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">
                  #{player.jerseyNumber} {getPlayerDisplayName(player)}
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  {positionLabels[player.position]}
                </p>
              </div>
              <button
                className="h-9 rounded-md border border-[#EF4444]/60 px-3 text-sm font-bold text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white"
                onClick={() => onDeletePlayer(player.id)}
                type="button"
              >
                Obrisi
              </button>
            </div>
          ))}
        </div>
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
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "number" | "text";
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
  form: PlayerFormState,
  selectedTournament: Tournament | undefined,
  selectedTeam: Team | undefined,
  teamPlayers: Player[],
) {
  const errors: FormErrors = {};
  const jerseyNumber = Number(form.jerseyNumber);

  if (!selectedTournament) {
    errors.tournament = "Izaberi turnir.";
  }

  if (!selectedTeam) {
    errors.teamId = "Izaberi ekipu.";
  }

  if (!form.firstName.trim()) {
    errors.firstName = "Ime je obavezno.";
  }

  if (!form.lastName.trim()) {
    errors.lastName = "Prezime je obavezno.";
  }

  if (
    !Number.isInteger(jerseyNumber) ||
    jerseyNumber < 0 ||
    jerseyNumber > 99
  ) {
    errors.jerseyNumber = "Broj dresa mora biti od 0 do 99.";
  } else if (
    teamPlayers.some((player) => player.jerseyNumber === jerseyNumber)
  ) {
    errors.jerseyNumber = "Taj broj vec postoji u ekipi.";
  }

  return errors;
}
