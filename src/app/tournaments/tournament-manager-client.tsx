"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { confirmDelete } from "../lib/confirm-delete";
import { createId } from "../lib/id";
import {
  saveMatchEvents,
  useMatchEvents,
  type MatchEvent,
} from "../live-score/match-event-store";
import {
  buildAutomaticGroupMatchPlan,
  getAutomaticGroupMatchId,
} from "../matches/auto-group-matches";
import {
  buildAutomaticKnockoutPlan,
  buildKnockoutMatchesFromPlan,
  ensureAutomaticKnockout,
} from "../matches/auto-knockout";
import { AutomaticGroupMatchesPanel } from "../matches/automatic-group-matches-panel";
import { AutomaticKnockoutPanel } from "../matches/automatic-knockout-panel";
import { KnockoutBracket } from "../matches/knockout-bracket";
import {
  getMatchPhase,
  matchPhaseLabels,
  saveMatches,
  useMatches,
  type Match,
  type MatchPhase,
} from "../matches/match-store";
import {
  getPlayerDisplayName,
  savePlayers,
  usePlayers,
  type Player,
} from "../players/player-store";
import {
  getTopAssistPlayers,
  getTopFoulPlayers,
  getTopOnePointScorers,
  getTopReboundPlayers,
  getTopScorers,
  getTopTwoPointShooters,
} from "../player-stats/player-stats-calculator";
import { calculateStandings } from "../standings/standings-calculator";
import { saveTeams, useTeams, type Team } from "../teams/team-store";
import {
  getEnabledMatchPhases,
  getQualifiersPerGroupText,
  getRecommendedTournamentFormat,
  getTournamentFormat,
  type KnockoutTeams,
} from "./tournament-format";
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
  groupCount: string;
  knockoutTeams: string;
  numberOfCourts: string;
  maxTeams: string;
  status: EditableTournamentStatus;
  tournamentType: TournamentType;
};

type FormErrors = Partial<Record<keyof TournamentFormState, string>>;
type EditableTournamentStatus = "CANCELLED" | "DRAFT" | "FINISHED" | "ONGOING";
type TournamentTab =
  | "BRACKET"
  | "FINAL"
  | "GROUP_STAGE"
  | "OVERVIEW"
  | "PLAYERS"
  | "QUARTER_FINAL"
  | "SEMI_FINAL"
  | "THIRD_PLACE"
  | "SETTINGS"
  | "STATS"
  | "TEAMS";

const defaultFormState: TournamentFormState = {
  name: "",
  description: "",
  location: "",
  city: "",
  country: "Srbija",
  startDate: getTodayInputValue(),
  endDate: getTodayInputValue(),
  groupCount: "2",
  knockoutTeams: "4",
  numberOfCourts: "2",
  maxTeams: "8",
  status: "DRAFT",
  tournamentType: "GROUPS_AND_KNOCKOUT",
};

const statusLabels: Record<TournamentStatus, string> = {
  CANCELLED: "Otkazan",
  DRAFT: "U pripremi",
  FINISHED: "Završen",
  ONGOING: "U toku",
  REGISTRATION_CLOSED: "U pripremi",
  REGISTRATION_OPEN: "U pripremi",
};

const editableStatusLabels: Record<EditableTournamentStatus, string> = {
  CANCELLED: "Otkazan",
  DRAFT: "U pripremi",
  FINISHED: "Završen",
  ONGOING: "U toku",
};

const typeLabels: Record<TournamentType, string> = {
  GROUP_STAGE: "Grupna faza",
  KNOCKOUT: "Eliminacije",
  GROUPS_AND_KNOCKOUT: "Grupe + eliminacije",
  LEAGUE: "Liga",
};

const knockoutTeamOptions = {
  "2": "2 ekipe - finale",
  "4": "4 ekipe - polufinale",
  "8": "8 ekipa - četvrtfinale",
};

const standardGroupCountOptions: Record<string, string> = {
  "1": "1 grupa",
  "2": "2 grupe",
  "4": "4 grupe",
};

const twelveTeamGroupCountOptions: Record<string, string> = {
  "2": "2 grupe - A i B",
  "4": "4 grupe - A, B, C i D",
};

const tournamentTabs: Array<{ label: string; value: TournamentTab }> = [
  { label: "Pregled", value: "OVERVIEW" },
  { label: "Ekipe", value: "TEAMS" },
  { label: "Igrači", value: "PLAYERS" },
  { label: "Grupna faza", value: "GROUP_STAGE" },
  { label: "Četvrtfinale", value: "QUARTER_FINAL" },
  { label: "Polufinale", value: "SEMI_FINAL" },
  { label: "Za treće mesto", value: "THIRD_PLACE" },
  { label: "Finale", value: "FINAL" },
  { label: "Knockout stablo", value: "BRACKET" },
  { label: "Statistika", value: "STATS" },
  { label: "Podešavanja", value: "SETTINGS" },
];

export function TournamentManagerClient() {
  const matchEvents = useMatchEvents();
  const matches = useMatches();
  const players = usePlayers();
  const teams = useTeams();
  const tournaments = useTournaments();
  const [form, setForm] = useState<TournamentFormState>(defaultFormState);
  const [editForm, setEditForm] =
    useState<TournamentFormState>(defaultFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [editErrors, setEditErrors] = useState<FormErrors>({});
  const [activeTab, setActiveTab] = useState<TournamentTab>("OVERVIEW");
  const [editingTournamentId, setEditingTournamentId] = useState<string>();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>();

  const selectedTournament =
    tournaments.find((tournament) => tournament.id === selectedTournamentId) ??
    tournaments[0];

  const metrics = useMemo(() => {
    const liveCount = tournaments.filter(
      (tournament) => tournament.status === "ONGOING",
    ).length;
    const capacity = tournaments.reduce(
      (total, tournament) => total + tournament.maxTeams,
      0,
    );

    return {
      capacity,
      liveCount,
      tournamentCount: tournaments.length,
    };
  }, [tournaments]);

  function updateField<K extends keyof TournamentFormState>(
    field: K,
    value: TournamentFormState[K],
  ) {
    setForm((currentForm) => {
      if (field !== "maxTeams") {
        return { ...currentForm, [field]: value };
      }

      const recommendedFormat = getRecommendedTournamentFormat(Number(value));

      return {
        ...currentForm,
        maxTeams: value,
        groupCount: recommendedFormat.groupCount.toString(),
        knockoutTeams: recommendedFormat.knockoutTeams.toString(),
      };
    });
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }

  function updateEditField<K extends keyof TournamentFormState>(
    field: K,
    value: TournamentFormState[K],
  ) {
    setEditForm((currentForm) => {
      if (field !== "maxTeams") {
        return { ...currentForm, [field]: value };
      }

      const recommendedFormat = getRecommendedTournamentFormat(Number(value));

      return {
        ...currentForm,
        maxTeams: value,
        groupCount: recommendedFormat.groupCount.toString(),
        knockoutTeams: recommendedFormat.knockoutTeams.toString(),
      };
    });
    setEditErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  }

  function createTournament(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const now = new Date().toISOString();
    const recommendedFormat = getRecommendedTournamentFormat(Number(form.maxTeams));
    const tournament: Tournament = {
      id: createId("tournament"),
      name: form.name.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      groupCount: Number(form.groupCount) || recommendedFormat.groupCount,
      knockoutTeams:
        Number(form.knockoutTeams) || recommendedFormat.knockoutTeams,
      numberOfCourts: Number(form.numberOfCourts),
      maxTeams: Number(form.maxTeams),
      status: form.status,
      tournamentType: form.tournamentType,
      registrationOpen: false,
      publicSlug: createUniqueSlug(form.name, tournaments),
      createdAt: now,
      updatedAt: now,
    };

    saveTournaments([tournament, ...tournaments]);
    setSelectedTournamentId(tournament.id);
    setForm(defaultFormState);
    setErrors({});
  }

  function startEditTournament(tournament: Tournament) {
    setEditingTournamentId(tournament.id);
    setSelectedTournamentId(tournament.id);
    setEditForm(getTournamentFormState(tournament));
    setEditErrors({});
  }

  function cancelEditTournament() {
    setEditingTournamentId(undefined);
    setEditForm(defaultFormState);
    setEditErrors({});
  }

  function saveTournamentEdit(
    event: React.FormEvent<HTMLFormElement>,
    tournamentId: string,
  ) {
    event.preventDefault();

    const teamCount = teams.filter(
      (team) => team.tournamentId === tournamentId,
    ).length;
    const nextErrors = {
      ...validateForm(editForm),
      ...(Number(editForm.maxTeams) < teamCount
        ? {
            maxTeams: `Ne može manje od ${teamCount}, jer toliko ekipa već postoji.`,
          }
        : {}),
    };
    setEditErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const recommendedFormat = getRecommendedTournamentFormat(
      Number(editForm.maxTeams),
    );
    const now = new Date().toISOString();

    saveTournaments(
      tournaments.map((tournament) =>
        tournament.id === tournamentId
          ? {
              ...tournament,
              city: editForm.city.trim(),
              country: editForm.country.trim(),
              description: editForm.description.trim(),
              endDate: editForm.endDate,
              groupCount:
                Number(editForm.groupCount) || recommendedFormat.groupCount,
              knockoutTeams:
                Number(editForm.knockoutTeams) ||
                recommendedFormat.knockoutTeams,
              location: editForm.location.trim(),
              maxTeams: Number(editForm.maxTeams),
              name: editForm.name.trim(),
              numberOfCourts: Number(editForm.numberOfCourts),
              registrationOpen: false,
              startDate: editForm.startDate,
              status: editForm.status,
              tournamentType: editForm.tournamentType,
              updatedAt: now,
            }
          : tournament,
      ),
    );
    setSelectedTournamentId(tournamentId);
    cancelEditTournament();
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
            registrationOpen: false,
            updatedAt: new Date().toISOString(),
          }
        : tournament,
    );

    saveTournaments(nextTournaments);
  }

  function updateTournamentFormat(
    tournamentId: string,
    field: "groupCount" | "knockoutTeams",
    value: number,
  ) {
    const nextTournaments = tournaments.map((tournament) =>
      tournament.id === tournamentId
        ? {
            ...tournament,
            [field]: value,
            updatedAt: new Date().toISOString(),
          }
        : tournament,
    );

    saveTournaments(nextTournaments);
  }

  function deleteTournament(tournamentId: string) {
    if (!confirmDelete()) {
      return;
    }

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
      players.filter(
        (player) =>
          player.tournamentId !== tournamentId &&
          !deletedTeamIds.has(player.teamId),
      ),
    );
    saveMatches(matches.filter((match) => match.tournamentId !== tournamentId));
    saveMatchEvents(
      matchEvents.filter(
        (event) =>
          event.tournamentId !== tournamentId &&
          !deletedMatchIds.has(event.matchId),
      ),
    );
    setSelectedTournamentId(nextTournaments[0]?.id);

    if (editingTournamentId === tournamentId) {
      cancelEditTournament();
    }
  }

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">
            Tvoja organizatorska tabla
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">Turniri</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Turniri" value={metrics.tournamentCount.toString()} />
          <Metric label="U toku" value={metrics.liveCount.toString()} />
          <Metric label="Kapacitet" value={metrics.capacity.toString()} />
        </div>
      </header>

      <div className="mt-6 grid gap-6 2xl:grid-cols-[400px_minmax(0,1fr)]">
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
              placeholder="Beograd 3x3 leto"
              value={form.name}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                error={errors.city}
                label="Grad"
                name="city"
                onChange={(value) => updateField("city", value)}
                placeholder="Beograd"
                value={form.city}
              />
              <TextField
                error={errors.country}
                label="Država"
                name="country"
                onChange={(value) => updateField("country", value)}
                placeholder="Srbija"
                value={form.country}
              />
            </div>

              <TextField
                error={errors.location}
                label="Lokacija"
                name="location"
                onChange={(value) => updateField("location", value)}
                placeholder="Ada Ciganlija, kos 1"
                value={form.location}
              />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                error={errors.startDate}
                label="Datum početka"
                name="startDate"
                onChange={(value) => updateField("startDate", value)}
                type="date"
                value={form.startDate}
              />
              <TextField
                error={errors.endDate}
                label="Datum završetka"
                name="endDate"
                onChange={(value) => updateField("endDate", value)}
                type="date"
                value={form.endDate}
              />
            </div>

            <TextField
              error={errors.maxTeams}
              label="Maks. ekipa"
              min={2}
              name="maxTeams"
              onChange={(value) => updateField("maxTeams", value)}
              type="number"
              value={form.maxTeams}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                error={errors.groupCount}
                label="Broj grupa"
                name="groupCount"
                onChange={(value) => updateField("groupCount", value)}
                options={getGroupCountOptions(Number(form.maxTeams))}
                value={form.groupCount}
              />
              <SelectField
                label="Ekipe u knockout-u"
                name="knockoutTeams"
                onChange={(value) => updateField("knockoutTeams", value)}
                options={knockoutTeamOptions}
                value={form.knockoutTeams}
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
                onChange={(value) => updateField("status", value)}
                options={editableStatusLabels}
                value={form.status}
              />
            </div>

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
              Sačuvaj turnir
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
                  : "Nema sačuvanih turnira."}
              </p>
            </div>
            {selectedTournament && (
              <span className="rounded-md bg-[#F97316]/15 px-3 py-2 text-xs font-black text-[#FACC15]">
                Interni turnir
              </span>
            )}
          </div>

          {tournaments.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-white/15 bg-[#0F172A] p-6 text-center">
              <p className="text-lg font-bold text-white">
                Jos nema turnira
              </p>
              <p className="mt-2 text-sm text-[#94A3B8]">
                Popuni formu levo i prvi turnir će se pojaviti ovde.
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
                  editErrors={editErrors}
                  editForm={editForm}
                  isEditing={tournament.id === editingTournamentId}
                  key={tournament.id}
                  onCancelEdit={cancelEditTournament}
                  onDelete={deleteTournament}
                  onEdit={startEditTournament}
                  onEditFieldChange={updateEditField}
                  onSaveEdit={saveTournamentEdit}
                  onSelect={setSelectedTournamentId}
                  onStatusChange={updateTournamentStatus}
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

      {selectedTournament && (
        <TournamentWorkspace
          activeTab={activeTab}
          allMatches={matches}
          matchEvents={matchEvents}
          matches={matches.filter(
            (match) => match.tournamentId === selectedTournament.id,
          )}
          onFormatChange={updateTournamentFormat}
          onSelectTab={setActiveTab}
          players={players.filter(
            (player) => player.tournamentId === selectedTournament.id,
          )}
          tabs={tournamentTabs}
          teams={teams.filter(
            (team) => team.tournamentId === selectedTournament.id,
          )}
          tournament={selectedTournament}
        />
      )}
    </div>
  );
}

function TournamentWorkspace({
  activeTab,
  allMatches,
  matchEvents,
  matches,
  onFormatChange,
  onSelectTab,
  players,
  tabs,
  teams,
  tournament,
}: {
  activeTab: TournamentTab;
  allMatches: Match[];
  matchEvents: MatchEvent[];
  matches: Match[];
  onFormatChange: (
    tournamentId: string,
    field: "groupCount" | "knockoutTeams",
    value: number,
  ) => void;
  onSelectTab: (tab: TournamentTab) => void;
  players: Player[];
  tabs: Array<{ label: string; value: TournamentTab }>;
  teams: Team[];
  tournament: Tournament;
}) {
  const format = getTournamentFormat(tournament, teams.length);
  const enabledPhases = getEnabledMatchPhases(format);
  const visibleTabs = tabs.filter((tab) =>
    isPhaseTab(tab.value) ? enabledPhases.includes(tab.value) : true,
  );
  const effectiveActiveTab = visibleTabs.some((tab) => tab.value === activeTab)
    ? activeTab
    : "OVERVIEW";
  const groupMatches = matches.filter(
    (match) => getMatchPhase(match) === "GROUP_STAGE",
  );
  const unassignedTeams = teams.filter((team) => !team.groupName.trim());
  const standings = calculateStandings({ matches: groupMatches, teams });
  const automaticGroupMatchPlan = useMemo(
    () =>
      buildAutomaticGroupMatchPlan({
        matches: allMatches,
        teams,
        tournamentId: tournament.id,
      }),
    [allMatches, teams, tournament.id],
  );
  const automaticKnockoutPlan = useMemo(
    () =>
      buildAutomaticKnockoutPlan({
        matches: allMatches,
        teams,
        tournament,
        tournamentId: tournament.id,
      }),
    [allMatches, teams, tournament],
  );
  const statsSource = {
    events: matchEvents,
    matches,
    players,
    teams,
  };

  useEffect(() => {
    if (
      unassignedTeams.length > 0 ||
      (!automaticKnockoutPlan.canCreate && !automaticKnockoutPlan.canReplace)
    ) {
      return;
    }

    const nextMatches = ensureAutomaticKnockout({
      matches: allMatches,
      teams,
      tournament,
      tournamentId: tournament.id,
    });

    if (nextMatches !== allMatches) {
      saveMatches(nextMatches);
    }
  }, [
    allMatches,
    automaticKnockoutPlan,
    teams,
    tournament,
    unassignedTeams.length,
  ]);

  function createAutomaticGroupMatches() {
    if (!automaticGroupMatchPlan.canCreate) {
      return;
    }

    const now = new Date().toISOString();
    const groupMatchesToCreate = automaticGroupMatchPlan.pairings.map(
      (pairing, index): Match => ({
        courtName: getInternalBasketNameForGroup(pairing.groupName),
        createdAt: new Date(Date.now() + index).toISOString(),
        foulsA: 0,
        foulsB: 0,
        id: getAutomaticGroupMatchId(
          tournament.id,
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
        tournamentId: tournament.id,
        updatedAt: now,
      }),
    );

    saveMatches([...allMatches, ...groupMatchesToCreate]);
  }

  function createAutomaticKnockout() {
    if (!automaticKnockoutPlan.canCreate) {
      return;
    }

    const knockoutMatches = buildKnockoutMatchesFromPlan(
      automaticKnockoutPlan,
      tournament.id,
    );
    saveMatches([...allMatches, ...knockoutMatches]);
  }

  function replaceAutomaticKnockout() {
    if (!automaticKnockoutPlan.canReplace) {
      return;
    }

    const knockoutMatchIds = new Set(
      allMatches
        .filter(
          (match) =>
            match.tournamentId === tournament.id &&
            getMatchPhase(match) !== "GROUP_STAGE",
        )
        .map((match) => match.id),
    );
    const knockoutMatches = buildKnockoutMatchesFromPlan(
      automaticKnockoutPlan,
      tournament.id,
    );

    saveMatches([
      ...allMatches.filter((match) => !knockoutMatchIds.has(match.id)),
      ...knockoutMatches,
    ]);
    saveMatchEvents(
      matchEvents.filter((event) => !knockoutMatchIds.has(event.matchId)),
    );
  }

  return (
    <section className="mt-6 rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">
            Centar turnira
          </p>
          <h3 className="mt-1 text-2xl font-black tracking-normal">
            {tournament.name}
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Ekipe" value={teams.length.toString()} />
          <Metric label="Igrači" value={players.length.toString()} />
          <Metric label="Utakmice" value={matches.length.toString()} />
          <Metric
            label="Završeno"
            value={matches
              .filter((match) => match.status === "FINISHED")
              .length.toString()}
          />
        </div>
      </div>

      <div className="app-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {visibleTabs.map((tab) => (
          <button
            className={`shrink-0 rounded-md border px-2 py-2 text-sm font-black transition ${
              effectiveActiveTab === tab.value
                ? "border-[#F97316] bg-[#F97316] text-[#111827]"
                : "border-white/15 bg-[#0F172A] text-[#CBD5E1] hover:border-[#F97316]/70 hover:text-white"
            }`}
            key={tab.value}
            onClick={() => onSelectTab(tab.value)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {effectiveActiveTab === "OVERVIEW" && (
          <OverviewTab matches={matches} teams={teams} tournament={tournament} />
        )}
        {effectiveActiveTab === "TEAMS" && <TeamsTab teams={teams} />}
        {effectiveActiveTab === "PLAYERS" && (
          <PlayersTab players={players} teams={teams} />
        )}
        {effectiveActiveTab === "GROUP_STAGE" && (
          <div>
            {unassignedTeams.length > 0 ? (
              <GroupAssignmentRequired count={unassignedTeams.length} />
            ) : (
              <>
                <AutomaticGroupMatchesPanel
                  onCreate={createAutomaticGroupMatches}
                  plan={automaticGroupMatchPlan}
                />
                <div className="mt-5">
                  <GroupStageTab
                    matches={groupMatches}
                    standings={standings}
                    teams={teams}
                  />
                </div>
              </>
            )}
          </div>
        )}
        {effectiveActiveTab === "QUARTER_FINAL" && (
          <PhaseTab matches={matches} phase="QUARTER_FINAL" teams={teams} />
        )}
        {effectiveActiveTab === "SEMI_FINAL" && (
          <PhaseTab matches={matches} phase="SEMI_FINAL" teams={teams} />
        )}
        {effectiveActiveTab === "THIRD_PLACE" && (
          <PhaseTab matches={matches} phase="THIRD_PLACE" teams={teams} />
        )}
        {effectiveActiveTab === "FINAL" && (
          <PhaseTab matches={matches} phase="FINAL" teams={teams} />
        )}
        {effectiveActiveTab === "BRACKET" && (
          <div>
            <AutomaticKnockoutPanel
              onCreate={createAutomaticKnockout}
              onReplace={replaceAutomaticKnockout}
              plan={automaticKnockoutPlan}
            />
            <div className="mt-5">
              <KnockoutBracket
                knockoutTeams={format.knockoutTeams}
                matches={matches}
                teams={teams}
                tournamentId={tournament.id}
              />
            </div>
          </div>
        )}
        {effectiveActiveTab === "STATS" && (
          <StatsTab source={statsSource} tournamentId={tournament.id} />
        )}
        {effectiveActiveTab === "SETTINGS" && (
          <SettingsTab
            onFormatChange={onFormatChange}
            teamCount={teams.length}
            teams={teams}
            tournament={tournament}
          />
        )}
      </div>
    </section>
  );
}

function isPhaseTab(tab: TournamentTab): tab is MatchPhase {
  return (
    tab === "GROUP_STAGE" ||
    tab === "QUARTER_FINAL" ||
    tab === "SEMI_FINAL" ||
    tab === "THIRD_PLACE" ||
    tab === "FINAL"
  );
}

function OverviewTab({
  matches,
  teams,
  tournament,
}: {
  matches: Match[];
  teams: Team[];
  tournament: Tournament;
}) {
  const phaseCounts = getPhaseCounts(matches);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-lg border border-white/10 bg-[#0F172A] p-4">
        <h4 className="text-xl font-black">Pregled turnira</h4>
        <p className="mt-2 text-sm text-[#94A3B8]">
          {tournament.city}, {tournament.country} / {tournament.location}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Grupna faza" value={phaseCounts.GROUP_STAGE.toString()} />
          <Metric label="Četvrtfinale" value={phaseCounts.QUARTER_FINAL.toString()} />
          <Metric label="Polufinale" value={phaseCounts.SEMI_FINAL.toString()} />
          <Metric label="Treće mesto" value={phaseCounts.THIRD_PLACE.toString()} />
          <Metric label="Finale" value={phaseCounts.FINAL.toString()} />
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-[#0F172A] p-4">
        <h4 className="text-xl font-black">Grupe</h4>
        <div className="mt-4 grid gap-2">
          {[...new Set(teams.map((team) => team.groupName || "Bez grupe"))].map(
            (groupName) => (
              <div
                className="flex items-center justify-between rounded-md bg-white/[0.04] px-3 py-2"
                key={groupName}
              >
                <span className="text-sm font-bold text-white">
                  {groupName === "Bez grupe" ? groupName : `Grupa ${groupName}`}
                </span>
                <span className="text-sm font-black text-[#FACC15]">
                  {
                    teams.filter(
                      (team) => (team.groupName || "Bez grupe") === groupName,
                    ).length
                  }
                </span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function TeamsTab({ teams }: { teams: Team[] }) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {teams.map((team) => (
        <article
          className="rounded-lg border border-white/10 bg-[#0F172A] p-4"
          key={team.id}
        >
          <p className="text-lg font-black text-white">{team.name}</p>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {team.city} / {team.groupName ? `Grupa ${team.groupName}` : "Bez grupe"}
          </p>
          <p className="mt-2 text-sm text-[#CBD5E1]">
            Broj kapitena: {team.captainPhone || "-"}
          </p>
        </article>
      ))}
    </div>
  );
}

function PlayersTab({
  players,
  teams,
}: {
  players: Player[];
  teams: Team[];
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {teams.map((team) => {
        const teamPlayers = players.filter((player) => player.teamId === team.id);

        return (
          <article
            className="rounded-lg border border-white/10 bg-[#0F172A] p-4"
            key={team.id}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-black text-white">{team.name}</p>
              <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-bold text-[#CBD5E1]">
                {teamPlayers.length}
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {teamPlayers.length === 0 ? (
                <p className="text-sm text-[#94A3B8]">Nema igrača.</p>
              ) : (
                teamPlayers.map((player) => (
                  <p
                    className="rounded-md bg-white/[0.04] px-3 py-2 text-sm font-bold text-white"
                    key={player.id}
                  >
                    {getPlayerDisplayName(player)}
                  </p>
                ))
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function GroupStageTab({
  matches,
  standings,
  teams,
}: {
  matches: Match[];
  standings: ReturnType<typeof calculateStandings>;
  teams: Team[];
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 2xl:grid-cols-2">
        {standings.map((group) => (
          <section
            className="rounded-lg border border-white/10 bg-[#0F172A] p-4"
            key={group.groupName}
          >
            <h4 className="text-lg font-black text-white">{group.groupName}</h4>
            <div className="app-scrollbar mt-3 overflow-x-auto rounded-md border border-white/10">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead className="bg-[#182235] text-xs uppercase text-[#CBD5E1]">
                  <tr>
                    <th className="px-3 py-3">#</th>
                    <th className="px-3 py-3">Ekipa</th>
                    <th className="px-3 py-3 text-center">M</th>
                    <th className="px-3 py-3 text-center">P</th>
                    <th className="px-3 py-3 text-center">I</th>
                    <th className="px-3 py-3 text-center">Bod</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr className="border-t border-white/10 transition odd:bg-white/[0.015] hover:bg-white/[0.045]" key={row.team.id}>
                      <td className="px-3 py-3 font-black text-[#FACC15]">
                        {row.rank}
                      </td>
                      <td className="px-3 py-3 font-bold text-white">{row.team.name}</td>
                      <td className="px-3 py-3 text-center font-bold">{row.played}</td>
                      <td className="px-3 py-3 text-center font-bold">{row.wins}</td>
                      <td className="px-3 py-3 text-center font-bold">{row.losses}</td>
                      <td className="px-3 py-3 text-center font-black">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
      <MatchList matches={matches} teams={teams} />
    </div>
  );
}

function GroupAssignmentRequired({ count }: { count: number }) {
  return (
    <section className="rounded-lg border border-dashed border-[#F97316]/45 bg-[#0F172A] p-6 text-center">
      <h4 className="text-lg font-black text-white">
        Prvo rasporedite ekipe po grupama
      </h4>
      <p className="mx-auto mt-2 max-w-lg text-sm text-[#94A3B8]">
        Neraspoređenih ekipa: {count}.
      </p>
      <Link
        className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#F97316] px-4 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
        href="/teams"
      >
        Rasporedi ekipe
      </Link>
    </section>
  );
}

function PhaseTab({
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
    <section className="rounded-lg border border-white/10 bg-[#0F172A] p-4">
      <h4 className="text-xl font-black text-white">
        {matchPhaseLabels[phase]}
      </h4>
      <p className="mt-1 text-sm text-[#94A3B8]">
        Prikazane su samo utakmice iz ove faze.
      </p>
      <div className="mt-4">
        <MatchList matches={phaseMatches} teams={teams} />
      </div>
    </section>
  );
}

function MatchList({ matches, teams }: { matches: Match[]; teams: Team[] }) {
  if (matches.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-white/15 bg-[#0F172A] px-3 py-4 text-sm text-[#94A3B8]">
        Nema utakmica za prikaz.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {matches.map((match) => (
        <article
          className="rounded-md border border-white/10 bg-[#111827] p-3"
          key={match.id}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-white">
                {getTeamName(match.teamAId, teams)} protiv{" "}
                {getTeamName(match.teamBId, teams)}
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                {matchPhaseLabels[getMatchPhase(match)]}
              </p>
            </div>
            <div className="rounded-md bg-white/[0.04] px-3 py-2 text-lg font-black text-[#FACC15]">
              {match.scoreA}:{match.scoreB}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function StatsTab({
  source,
  tournamentId,
}: {
  source: {
    events: MatchEvent[];
    matches: Match[];
    players: Player[];
    teams: Team[];
  };
  tournamentId: string;
}) {
  const statGroups = [
    { label: "Poenteri", rows: getTopScorers(tournamentId, source), value: "totalPoints" },
    { label: "Sut za 2", rows: getTopTwoPointShooters(tournamentId, source), value: "twoPointMakes" },
    { label: "Sut za 1", rows: getTopOnePointScorers(tournamentId, source), value: "onePointMakes" },
    { label: "Asistenti", rows: getTopAssistPlayers(tournamentId, source), value: "assists" },
    { label: "Skakači", rows: getTopReboundPlayers(tournamentId, source), value: "rebounds" },
    { label: "Faulovi", rows: getTopFoulPlayers(tournamentId, source), value: "fouls" },
  ] as const;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {statGroups.map((group) => (
        <section
          className="rounded-lg border border-white/10 bg-[#0F172A] p-4"
          key={group.label}
        >
          <h4 className="text-lg font-black text-white">{group.label}</h4>
          <div className="mt-3 grid gap-2">
            {group.rows.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">Nema podataka.</p>
            ) : (
              group.rows.map((row) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-md bg-white/[0.04] px-3 py-2"
                  key={row.player.id}
                >
                  <span className="truncate text-sm font-bold text-white">
                    {getPlayerDisplayName(row.player)}
                  </span>
                  <span className="text-sm font-black text-[#FACC15]">
                    {row[group.value]}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function SettingsTab({
  onFormatChange,
  teamCount,
  teams,
  tournament,
}: {
  onFormatChange: (
    tournamentId: string,
    field: "groupCount" | "knockoutTeams",
    value: number,
  ) => void;
  teamCount: number;
  teams: Team[];
  tournament: Tournament;
}) {
  const format = getTournamentFormat(tournament, teamCount);
  const actualGroupCount = getActualGroupCount(teams);
  const effectiveGroupCount = actualGroupCount || format.groupCount;
  const groupCountOptions = getGroupCountOptionsForSettings(
    tournament.maxTeams,
    effectiveGroupCount,
  );
  const groupCountMismatch =
    actualGroupCount > 0 && actualGroupCount !== format.groupCount;
  const qualifiersPerGroupText = getQualifiersPerGroupText(
    effectiveGroupCount,
    format.knockoutTeams,
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Status" value={statusLabels[tournament.status]} />
        <Metric label="Format" value={typeLabels[tournament.tournamentType]} />
        <Metric label="Kapacitet" value={`${teamCount}/${tournament.maxTeams}`} />
      </div>

      <section className="rounded-lg border border-white/10 bg-[#0F172A] p-4">
        <h4 className="text-xl font-black text-white">Format turnira</h4>
        <p className="mt-1 text-sm text-[#94A3B8]">
          Ova pravila odredjuju kako se automatski pravi knockout stablo.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <SelectField
            label="Broj grupa"
            name="settings-group-count"
            onChange={(value) =>
              onFormatChange(tournament.id, "groupCount", Number(value))
            }
            options={groupCountOptions}
            value={effectiveGroupCount.toString()}
          />
          <SelectField
            label="Ekipe u knockout-u"
            name="settings-knockout-teams"
            onChange={(value) =>
              onFormatChange(
                tournament.id,
                "knockoutTeams",
                Number(value) as KnockoutTeams,
              )
            }
            options={knockoutTeamOptions}
            value={format.knockoutTeams.toString()}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Prolazi dalje" value={qualifiersPerGroupText} />
          <Metric
            label="Prva eliminacija"
            value={matchPhaseLabels[format.openingPhase]}
          />
          <Metric
            label="Stablo"
            value={`${format.knockoutTeams} ekipa`}
          />
        </div>

        {groupCountMismatch && (
          <p className="mt-4 rounded-md border border-[#38BDF8]/25 bg-[#38BDF8]/10 px-3 py-2 text-sm font-semibold text-[#7DD3FC]">
            Ekipe su već rasporedjene u {actualGroupCount} grupe, pa aplikacija
            koristi stvarni raspored grupa umesto starog sačuvanog podešavanja.
          </p>
        )}

        <p className="mt-4 rounded-md border border-[#FACC15]/25 bg-[#FACC15]/10 px-3 py-2 text-sm font-semibold text-[#FDE68A]">
          Ako knockout već postoji, promena formata će važiti kada kliknes
          dugme Zameni knockout u tabu Knockout stablo.
        </p>
      </section>
    </div>
  );
}

function getPhaseCounts(matches: Match[]) {
  return matches.reduce<Record<MatchPhase, number>>(
    (counts, match) => {
      counts[getMatchPhase(match)] += 1;
      return counts;
    },
    {
      FINAL: 0,
      GROUP_STAGE: 0,
      QUARTER_FINAL: 0,
      SEMI_FINAL: 0,
      THIRD_PLACE: 0,
    },
  );
}

function getTeamName(teamId: string, teams: Team[]) {
  if (!teamId) {
    return "Čeka protivnika";
  }

  return teams.find((team) => team.id === teamId)?.name ?? "Nepoznata ekipa";
}

function getInternalBasketNameForGroup(groupName: string) {
  const normalizedGroup = groupName.toLowerCase();

  if (normalizedGroup.includes("grupa b")) {
    return "Kos 2";
  }

  return "Kos 1";
}

function TournamentCard({
  editErrors,
  editForm,
  isSelected,
  isEditing,
  onCancelEdit,
  onDelete,
  onEdit,
  onEditFieldChange,
  onSaveEdit,
  onSelect,
  onStatusChange,
  teamCount,
  tournament,
}: {
  editErrors: FormErrors;
  editForm: TournamentFormState;
  isSelected: boolean;
  isEditing: boolean;
  onCancelEdit: () => void;
  onDelete: (tournamentId: string) => void;
  onEdit: (tournament: Tournament) => void;
  onEditFieldChange: <K extends keyof TournamentFormState>(
    field: K,
    value: TournamentFormState[K],
  ) => void;
  onSaveEdit: (
    event: React.FormEvent<HTMLFormElement>,
    tournamentId: string,
  ) => void;
  onSelect: (tournamentId: string) => void;
  onStatusChange: (tournamentId: string, status: EditableTournamentStatus) => void;
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
            onChange={(value) => onStatusChange(tournament.id, value)}
            options={editableStatusLabels}
            value={normalizeTournamentStatus(tournament.status)}
          />
          <button
            className="h-10 w-full rounded-md border border-white/15 px-3 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
            onClick={() =>
              isEditing ? onCancelEdit() : onEdit(tournament)
            }
            type="button"
          >
            {isEditing ? "Zatvori" : "Izmeni"}
          </button>
          <button
            className="h-10 w-full rounded-md border border-[#EF4444]/60 px-3 text-sm font-bold text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white"
            onClick={() => onDelete(tournament.id)}
            type="button"
          >
            Obriši
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Datum" value={formatDateRange(tournament)} />
        <Metric label="Format" value={typeLabels[tournament.tournamentType]} />
        <Metric label="Ekipe" value={`${teamCount}/${tournament.maxTeams}`} />
      </div>

      {tournament.description && (
        <p className="mt-4 rounded-md bg-white/[0.04] px-3 py-2 text-sm text-[#CBD5E1]">
          {tournament.description}
        </p>
      )}

      {isEditing && (
        <form
          className="mt-4 rounded-lg border border-[#F97316]/25 bg-[#111827] p-4"
          onSubmit={(event) => onSaveEdit(event, tournament.id)}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField
              error={editErrors.name}
              label="Naziv turnira"
              name={`edit-name-${tournament.id}`}
              onChange={(value) => onEditFieldChange("name", value)}
              value={editForm.name}
            />
            <TextField
              error={editErrors.location}
              label="Lokacija"
              name={`edit-location-${tournament.id}`}
              onChange={(value) => onEditFieldChange("location", value)}
              value={editForm.location}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              error={editErrors.city}
              label="Grad"
              name={`edit-city-${tournament.id}`}
              onChange={(value) => onEditFieldChange("city", value)}
              value={editForm.city}
            />
            <TextField
              error={editErrors.country}
              label="Država"
              name={`edit-country-${tournament.id}`}
              onChange={(value) => onEditFieldChange("country", value)}
              value={editForm.country}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              error={editErrors.startDate}
              label="Datum početka"
              name={`edit-start-date-${tournament.id}`}
              onChange={(value) => onEditFieldChange("startDate", value)}
              type="date"
              value={editForm.startDate}
            />
            <TextField
              error={editErrors.endDate}
              label="Datum završetka"
              name={`edit-end-date-${tournament.id}`}
              onChange={(value) => onEditFieldChange("endDate", value)}
              type="date"
              value={editForm.endDate}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <TextField
              error={editErrors.maxTeams}
              label="Maks. ekipa"
              min={2}
              name={`edit-max-teams-${tournament.id}`}
              onChange={(value) => onEditFieldChange("maxTeams", value)}
              type="number"
              value={editForm.maxTeams}
            />
            <SelectField
              error={editErrors.groupCount}
              label="Broj grupa"
              name={`edit-group-count-${tournament.id}`}
              onChange={(value) => onEditFieldChange("groupCount", value)}
              options={getGroupCountOptions(Number(editForm.maxTeams))}
              value={editForm.groupCount}
            />
            <SelectField
              error={editErrors.knockoutTeams}
              label="Ekipe u knockout-u"
              name={`edit-knockout-teams-${tournament.id}`}
              onChange={(value) => onEditFieldChange("knockoutTeams", value)}
              options={knockoutTeamOptions}
              value={editForm.knockoutTeams}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Format"
              name={`edit-format-${tournament.id}`}
              onChange={(value) =>
                onEditFieldChange("tournamentType", value as TournamentType)
              }
              options={typeLabels}
              value={editForm.tournamentType}
            />
            <SelectField
              label="Status"
              name={`edit-status-${tournament.id}`}
              onChange={(value) => onEditFieldChange("status", value)}
              options={editableStatusLabels}
              value={editForm.status}
            />
          </div>

          <div className="mt-4">
            <label
              className="text-sm font-semibold text-[#CBD5E1]"
              htmlFor={`edit-description-${tournament.id}`}
            >
              Opis
            </label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-white/10 bg-[#0F172A] px-3 py-3 text-sm text-white outline-none transition placeholder:text-[#64748B] focus:border-[#F97316]"
              id={`edit-description-${tournament.id}`}
              name={`edit-description-${tournament.id}`}
              onChange={(event) =>
                onEditFieldChange("description", event.target.value)
              }
              value={editForm.description}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              className="h-11 rounded-md bg-[#F97316] px-4 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
              type="submit"
            >
              Sačuvaj izmene
            </button>
            <button
              className="h-11 rounded-md border border-white/15 px-4 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
              onClick={onCancelEdit}
              type="button"
            >
              Odustani
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

function normalizeTournamentStatus(status: TournamentStatus): EditableTournamentStatus {
  if (status === "REGISTRATION_OPEN" || status === "REGISTRATION_CLOSED") {
    return "DRAFT";
  }

  return status;
}

function getTournamentFormState(tournament: Tournament): TournamentFormState {
  const recommendedFormat = getRecommendedTournamentFormat(tournament.maxTeams);

  return {
    city: tournament.city,
    country: tournament.country,
    description: tournament.description,
    endDate: tournament.endDate,
    groupCount: (
      tournament.groupCount ?? recommendedFormat.groupCount
    ).toString(),
    knockoutTeams: (
      tournament.knockoutTeams ?? recommendedFormat.knockoutTeams
    ).toString(),
    location: tournament.location,
    maxTeams: tournament.maxTeams.toString(),
    name: tournament.name,
    numberOfCourts: tournament.numberOfCourts.toString(),
    startDate: tournament.startDate,
    status: normalizeTournamentStatus(tournament.status),
    tournamentType: tournament.tournamentType,
  };
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
  const groupCount = Number(form.groupCount);
  const knockoutTeams = Number(form.knockoutTeams);
  const maxTeams = Number(form.maxTeams);

  if (!form.name.trim()) {
    errors.name = "Naziv je obavezan.";
  }

  if (!form.city.trim()) {
    errors.city = "Grad je obavezan.";
  }

  if (!form.country.trim()) {
    errors.country = "Država je obavezna.";
  }

  if (!form.location.trim()) {
    errors.location = "Lokacija je obavezna.";
  }

  if (!form.startDate) {
    errors.startDate = "Datum početka je obavezan.";
  }

  if (!form.endDate) {
    errors.endDate = "Datum završetka je obavezan.";
  }

  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    errors.endDate = "Završetak ne može biti pre početka.";
  }

  if (!Number.isInteger(maxTeams) || maxTeams < 2) {
    errors.maxTeams = "Unesi bar 2 ekipe.";
  }

  if (!Number.isInteger(groupCount) || groupCount < 1) {
    errors.groupCount = "Izaberi broj grupa.";
  }

  if (maxTeams === 12 && groupCount !== 2 && groupCount !== 4) {
    errors.groupCount = "Za 12 ekipa izaberi 2 ili 4 grupe.";
  }

  if (knockoutTeams !== 2 && knockoutTeams !== 4 && knockoutTeams !== 8) {
    errors.knockoutTeams = "Izaberi 2, 4 ili 8 ekipa.";
  }

  return errors;
}

function getGroupCountOptions(maxTeams: number) {
  return maxTeams === 12
    ? twelveTeamGroupCountOptions
    : standardGroupCountOptions;
}

function getGroupCountOptionsForSettings(
  maxTeams: number,
  actualGroupCount: number,
) {
  const options = { ...getGroupCountOptions(maxTeams) };
  const actualGroupCountKey = actualGroupCount.toString();

  if (actualGroupCount > 0 && !options[actualGroupCountKey]) {
    options[actualGroupCountKey] = `${actualGroupCount} grupe`;
  }

  return options;
}

function getActualGroupCount(teams: Team[]) {
  const groupNames = new Set(
    teams
      .map((team) => team.groupName.trim())
      .filter((groupName) => groupName.length > 0),
  );

  return groupNames.size;
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
