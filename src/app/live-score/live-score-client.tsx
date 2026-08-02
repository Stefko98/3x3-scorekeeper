"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { confirmDelete } from "../lib/confirm-delete";
import { createId } from "../lib/id";
import { orderMatchesForSchedule } from "../matches/auto-group-matches";
import { ensureAutomaticKnockout } from "../matches/auto-knockout";
import {
  applyKnockoutProgression,
  canSafelyReopenMatch,
  canStartKnockoutMatch,
  rollbackKnockoutProgression,
} from "../matches/knockout-utils";
import {
  getMatchPhase,
  saveMatches,
  useMatches,
  type Match,
  type MatchStatus,
} from "../matches/match-store";
import {
  getPlayerDisplayName,
  usePlayers,
  type Player,
} from "../players/player-store";
import { useTeams, type Team } from "../teams/team-store";
import {
  getEnabledMatchPhases,
  getTournamentFormat,
} from "../tournaments/tournament-format";
import { useTournaments } from "../tournaments/tournament-store";
import {
  saveMatchEvents,
  useMatchEvents,
  type MatchEvent,
  type MatchEventType,
} from "./match-event-store";
import {
  getMatchJerseyId,
  getVisualMatchJerseyMap,
  saveMatchJerseys,
  useMatchJerseys,
} from "./match-jersey-store";
import {
  getMatchEndDecision,
  type MatchEndDecision,
} from "./match-end-rules";
import { useMatchLock } from "./match-lock-store";

type LiveScoreClientProps = {
  initialMatchId?: string;
};

type ScoreBySide = {
  teamA: number;
  teamB: number;
};

type ScorekeepingEventType = "POINT" | "FOUL" | "ASSIST" | "REBOUND";

type LivePlayerStats = {
  assists: number;
  fouls: number;
  points: number;
  rebounds: number;
};

type MatchStatusFilter = "ALL" | "SCHEDULED" | "LIVE" | "PAUSED" | "FINISHED";

const matchStatusFilterLabels: Record<MatchStatusFilter, string> = {
  ALL: "Svi statusi",
  FINISHED: "Završene",
  LIVE: "Uživo",
  PAUSED: "Pauza",
  SCHEDULED: "Zakazane",
};

const pointLimit = 21;
const foulLimit = 6;
const matchLengthSeconds = 10 * 60;
const overtimePointsToWin = 2;

export function LiveScoreClient({ initialMatchId }: LiveScoreClientProps) {
  const matchJerseys = useMatchJerseys();
  const matchEvents = useMatchEvents();
  const matches = useMatches();
  const players = usePlayers();
  const teams = useTeams();
  const tournaments = useTournaments();
  const [clockTickMs, setClockTickMs] = useState(0);
  const [selectedGroupName, setSelectedGroupName] = useState("ALL");
  const [selectedMatchId, setSelectedMatchId] = useState(initialMatchId ?? "");
  const [selectedMatchStatusFilter, setSelectedMatchStatusFilter] =
    useState<MatchStatusFilter>("ALL");
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>();
  const [dismissedEndDecisionKey, setDismissedEndDecisionKey] =
    useState<string>();

  const availableMatches = useMemo(
    () => matches.filter((match) => match.status !== "CANCELLED"),
    [matches],
  );
  const initialMatch = useMemo(
    () =>
      initialMatchId
        ? availableMatches.find((match) => match.id === initialMatchId)
        : undefined,
    [availableMatches, initialMatchId],
  );
  const tournamentIdsWithMatches = useMemo(
    () => [...new Set(availableMatches.map((match) => match.tournamentId))],
    [availableMatches],
  );
  const activeTournamentId =
    selectedTournamentId &&
    tournamentIdsWithMatches.includes(selectedTournamentId)
      ? selectedTournamentId
      : initialMatch?.tournamentId ?? tournamentIdsWithMatches[0] ?? "";
  const activeTournament = tournaments.find(
    (item) => item.id === activeTournamentId,
  );
  const activeTournamentTeamCount = teams.filter(
    (team) => team.tournamentId === activeTournamentId,
  ).length;
  const activeTournamentFormat = getTournamentFormat(
    activeTournament,
    activeTournamentTeamCount,
  );
  const enabledPhases = getEnabledMatchPhases(activeTournamentFormat);

  useEffect(() => {
    if (!activeTournamentId) {
      return;
    }

    const nextMatches = ensureAutomaticKnockout({
      matches,
      teams,
      tournament: activeTournament,
      tournamentId: activeTournamentId,
    });

    if (nextMatches !== matches) {
      saveMatches(nextMatches);
    }
  }, [activeTournament, activeTournamentId, matches, teams]);

  const tournamentMatches = useMemo(
    () =>
      activeTournamentId
        ? availableMatches.filter(
            (match) =>
              match.tournamentId === activeTournamentId &&
              enabledPhases.includes(getMatchPhase(match)),
          )
        : availableMatches.filter((match) =>
            enabledPhases.includes(getMatchPhase(match)),
          ),
    [activeTournamentId, availableMatches, enabledPhases],
  );
  const tournamentOptions = useMemo(
    () =>
      tournaments.filter((tournament) =>
        tournamentIdsWithMatches.includes(tournament.id),
      ),
    [tournamentIdsWithMatches, tournaments],
  );
  const groupOptions = useMemo(
    () =>
      [
        ...new Set(
          tournamentMatches.map((match) =>
            getMatchFilterName(match, matches, teams),
          ),
        ),
      ]
        .filter(Boolean)
        .sort((groupA, groupB) => groupA.localeCompare(groupB)),
    [matches, teams, tournamentMatches],
  );
  const selectedGroupIsAvailable =
    selectedGroupName === "ALL" || groupOptions.includes(selectedGroupName);
  const groupFilteredMatches = useMemo(
    () =>
      selectedGroupName !== "ALL" && selectedGroupIsAvailable
        ? tournamentMatches.filter(
            (match) =>
              getMatchFilterName(match, matches, teams) === selectedGroupName,
          )
        : tournamentMatches,
    [
      matches,
      selectedGroupIsAvailable,
      selectedGroupName,
      teams,
      tournamentMatches,
    ],
  );
  const selectedStatusFilterIsAvailable =
    selectedMatchStatusFilter === "ALL" ||
    groupFilteredMatches.some(
      (match) => match.status === selectedMatchStatusFilter,
    );
  const filteredMatches = useMemo(
    () => {
      const statusFilteredMatches =
        selectedMatchStatusFilter !== "ALL" && selectedStatusFilterIsAvailable
          ? groupFilteredMatches.filter(
              (match) => match.status === selectedMatchStatusFilter,
            )
          : groupFilteredMatches;

      return orderMatchesForSchedule(statusFilteredMatches, teams);
    },
    [
      groupFilteredMatches,
      selectedMatchStatusFilter,
      selectedStatusFilterIsAvailable,
      teams,
    ],
  );
  const selectedMatch =
    tournamentMatches.find((match) => match.id === selectedMatchId) ??
    filteredMatches.find((match) => match.status === "LIVE") ??
    filteredMatches.find((match) => match.status === "PAUSED") ??
    filteredMatches.find((match) => match.status === "SCHEDULED") ??
    filteredMatches[0];

  const teamA = selectedMatch
    ? teams.find((team) => team.id === selectedMatch.teamAId)
    : undefined;
  const teamB = selectedMatch
    ? teams.find((team) => team.id === selectedMatch.teamBId)
    : undefined;
  const canRecoverInvalidFinishedMatch = Boolean(
    selectedMatch?.status === "FINISHED" &&
      selectedMatch.scoreA === selectedMatch.scoreB &&
      !matchEvents.some(
        (event) =>
          event.matchId === selectedMatch.id &&
          !event.isDeleted &&
          isScorekeepingEvent(event.type),
      ),
  );
  const canReopenFinishedMatch = Boolean(
    selectedMatch &&
      selectedMatch.status === "FINISHED" &&
      canSafelyReopenMatch(matches, selectedMatch.id),
  );
  const lockableMatchId =
    selectedMatch &&
    teamA &&
    teamB &&
    (selectedMatch.status !== "FINISHED" ||
      canRecoverInvalidFinishedMatch ||
      canReopenFinishedMatch) &&
    selectedMatch.status !== "CANCELLED"
      ? selectedMatch.id
      : undefined;
  const matchLock = useMatchLock(lockableMatchId);
  const tournament = selectedMatch
    ? tournaments.find((item) => item.id === selectedMatch.tournamentId)
    : activeTournament;
  const matchJerseyMap = useMemo(
    () => getVisualMatchJerseyMap(matchJerseys, matches, selectedMatch),
    [matchJerseys, matches, selectedMatch],
  );
  const playersA = selectedMatch
    ? players
        .filter((player) => player.teamId === selectedMatch.teamAId)
        .sort(
          (a, b) =>
            comparePlayersForLiveScore(a, b, matchJerseyMap),
        )
    : [];
  const playersB = selectedMatch
    ? players
        .filter((player) => player.teamId === selectedMatch.teamBId)
        .sort(
          (a, b) =>
            comparePlayersForLiveScore(a, b, matchJerseyMap),
        )
    : [];
  const eventsForMatch = useMemo(
    () =>
      selectedMatch
        ? matchEvents.filter((event) => event.matchId === selectedMatch.id)
        : [],
    [matchEvents, selectedMatch],
  );
  const teamMap = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams],
  );
  const playerMap = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );
  const score = useMemo(
    () =>
      selectedMatch
        ? calculateScore(eventsForMatch, selectedMatch)
        : { teamA: 0, teamB: 0 },
    [eventsForMatch, selectedMatch],
  );
  const fouls = selectedMatch
    ? calculateFouls(eventsForMatch, selectedMatch)
    : { teamA: 0, teamB: 0 };
  const playerStats = calculatePlayerStats(eventsForMatch);
  const isOvertime = Boolean(selectedMatch?.overtimeStartedAt);
  const overtimeScore = selectedMatch
    ? getOvertimeScore(score, selectedMatch)
    : { teamA: 0, teamB: 0 };
  const remainingSeconds = selectedMatch
    ? getMatchRemainingSeconds(selectedMatch, clockTickMs, eventsForMatch)
    : matchLengthSeconds;
  const clock = formatClock(remainingSeconds);
  const canControlSelectedMatch =
    Boolean(lockableMatchId) && matchLock.lockedByCurrentDevice;
  const canStartSelectedMatch = Boolean(
    selectedMatch &&
      canControlSelectedMatch &&
      selectedMatch.status === "SCHEDULED" &&
      teamA &&
      teamB &&
      canStartKnockoutMatch(matches, selectedMatch.id),
  );
  const canEdit =
    selectedMatch?.status === "LIVE" &&
    Boolean(teamA && teamB) &&
    canControlSelectedMatch;
  const isFinished = selectedMatch?.status === "FINISHED";
  const hasScorekeepingEvents = hasActiveScorekeepingEvents(eventsForMatch);
  const canResetClock =
    canControlSelectedMatch &&
    !hasScorekeepingEvents &&
    !isOvertime &&
    (!isFinished || canRecoverInvalidFinishedMatch);
  const endDecision = selectedMatch
    ? getMatchEndDecision({
        matchStatus: selectedMatch.status,
        overtimePointsToWin,
        overtimeScore: isOvertime ? overtimeScore : undefined,
        pointLimit,
        remainingSeconds,
        score,
      })
    : undefined;
  const endDecisionKey =
    selectedMatch && endDecision
      ? [
          selectedMatch.id,
          endDecision,
          score.teamA,
          score.teamB,
          isOvertime ? "overtime" : "regulation",
        ].join(":")
      : undefined;
  const canOpenEndDecision = Boolean(
    canControlSelectedMatch && endDecision && endDecisionKey,
  );
  const showEndDecision = Boolean(
    canOpenEndDecision && endDecisionKey !== dismissedEndDecisionKey,
  );
  const selectedMatchIdForClock = selectedMatch?.id;
  const selectedMatchStatusForClock = selectedMatch?.status;
  const lastEditableEvent = useMemo(
    () =>
      [...eventsForMatch]
        .reverse()
        .find((event) => !event.isDeleted && isScorekeepingEvent(event.type)),
    [eventsForMatch],
  );

  useEffect(() => {
    if (!selectedMatch?.id || selectedMatchId === selectedMatch.id) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setSelectedMatchId(selectedMatch.id);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [selectedMatch?.id, selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchIdForClock || selectedMatchStatusForClock !== "LIVE") {
      return;
    }

    const timerId = window.setInterval(() => {
      setClockTickMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [selectedMatchIdForClock, selectedMatchStatusForClock]);

  const saveEventsAndMatch = useCallback(
    (
      nextEventsForMatch: MatchEvent[],
      nextStatus?: MatchStatus,
      options?: { baseMatches?: Match[]; startOvertime?: boolean },
    ) => {
      if (!selectedMatch || !canControlSelectedMatch) {
        return;
      }

      const nextScore = calculateScore(nextEventsForMatch, selectedMatch);
      const nextFouls = calculateFouls(nextEventsForMatch, selectedMatch);
      const nowDate = new Date();
      const now = nowDate.toISOString();
      const status = nextStatus ?? selectedMatch.status;

      window.setTimeout(() => setClockTickMs(nowDate.getTime()), 0);

      if (status === "FINISHED" && nextScore.teamA === nextScore.teamB) {
        return;
      }

      if (status === "FINISHED") {
        window.setTimeout(() => {
          setSelectedMatchId(selectedMatch.id);
          setSelectedMatchStatusFilter("ALL");
        }, 0);
      }

    const shouldUpdateClockAnchor =
      status !== selectedMatch.status || options?.startOvertime;
    const nextClockRemainingSeconds = shouldUpdateClockAnchor
      ? getMatchRemainingSeconds(
          selectedMatch,
          nowDate.getTime(),
          nextEventsForMatch,
        )
      : selectedMatch.clockRemainingSeconds;
    const nextClockUpdatedAt = shouldUpdateClockAnchor
      ? now
      : selectedMatch.clockUpdatedAt;
    const nextMatch = {
      ...selectedMatch,
      clockRemainingSeconds: nextClockRemainingSeconds,
      clockUpdatedAt: nextClockUpdatedAt,
      finishedAt: status === "FINISHED" ? now : undefined,
      foulsA: nextFouls.teamA,
      foulsB: nextFouls.teamB,
      overtimeStartedAt: options?.startOvertime
        ? now
        : selectedMatch.overtimeStartedAt,
      overtimeStartingScoreA: options?.startOvertime
        ? nextScore.teamA
        : selectedMatch.overtimeStartingScoreA,
      overtimeStartingScoreB: options?.startOvertime
        ? nextScore.teamB
        : selectedMatch.overtimeStartingScoreB,
      scoreA: nextScore.teamA,
      scoreB: nextScore.teamB,
      startedAt:
        status === "LIVE" && !selectedMatch.startedAt
          ? now
          : selectedMatch.startedAt,
      status,
      updatedAt: now,
      winnerTeamId:
        status === "FINISHED"
          ? getWinnerTeamId(nextScore, selectedMatch)
          : undefined,
    };
    const nextMatches = (options?.baseMatches ?? matches).map((match) =>
      match.id === selectedMatch.id ? nextMatch : match,
    );

    saveMatchEvents([
      ...matchEvents.filter((event) => event.matchId !== selectedMatch.id),
      ...nextEventsForMatch,
    ]);
    if (status !== "FINISHED") {
      saveMatches(nextMatches);
      return;
    }

    const progressedMatches = applyKnockoutProgression(
      nextMatches,
      selectedMatch.id,
    );

    saveMatches(
      ensureAutomaticKnockout({
        matches: progressedMatches,
        teams,
        tournament,
        tournamentId: selectedMatch.tournamentId,
      }),
    );
    },
    [
      canControlSelectedMatch,
      matchEvents,
      matches,
      selectedMatch,
      teams,
      tournament,
    ],
  );

  function appendControlEvent(
    type: MatchEventType,
    status: MatchStatus,
    description: string,
  ) {
    if (!selectedMatch || !canControlSelectedMatch) {
      return;
    }

    saveEventsAndMatch(
      [
        ...eventsForMatch,
        createEvent(selectedMatch, {
          clock,
          description,
          type,
        }),
      ],
      status,
    );
  }

  function startMatch() {
    if (
      !selectedMatch ||
      !canStartSelectedMatch
    ) {
      return;
    }

    appendControlEvent("START_MATCH", "LIVE", "Utakmica je pokrenuta");
  }

  function pauseMatch() {
    if (
      !selectedMatch ||
      !canControlSelectedMatch ||
      selectedMatch.status !== "LIVE"
    ) {
      return;
    }

    appendControlEvent("PAUSE_MATCH", "PAUSED", "Utakmica je pauzirana");
  }

  function resumeMatch() {
    if (
      !selectedMatch ||
      !canControlSelectedMatch ||
      selectedMatch.status !== "PAUSED"
    ) {
      return;
    }

    appendControlEvent("RESUME_MATCH", "LIVE", "Utakmica je nastavljena");
  }

  function startOvertime() {
    if (
      !selectedMatch ||
      !canControlSelectedMatch ||
      endDecision !== "OVERTIME"
    ) {
      return;
    }

    saveEventsAndMatch(
      [
        ...eventsForMatch,
        createEvent(selectedMatch, {
          clock: "00:00",
          description:
            "Počinje produžetak. Pobeđuje ekipa koja prva postigne " +
            overtimePointsToWin +
            " poena.",
          type: "START_OVERTIME",
        }),
      ],
      "LIVE",
      { startOvertime: true },
    );
    setDismissedEndDecisionKey(undefined);
  }

  function finishMatch() {
    if (
      !selectedMatch ||
      !canControlSelectedMatch ||
      endDecision !== "FINISH"
    ) {
      return;
    }

    appendControlEvent(
      "FINISH_MATCH",
      "FINISHED",
      "Utakmica je završena posle potvrde zapisničara. " +
        getWinnerText(score, selectedMatch, teamMap),
    );
    setDismissedEndDecisionKey(undefined);
  }

  function dismissEndDecision() {
    if (endDecisionKey) {
      setDismissedEndDecisionKey(endDecisionKey);
    }
  }

  function showMatchDecision() {
    setDismissedEndDecisionKey(undefined);
  }

  function resetMatchClock() {
    if (
      !selectedMatch ||
      !canControlSelectedMatch ||
      (selectedMatch.status === "FINISHED" &&
        !canRecoverInvalidFinishedMatch) ||
      selectedMatch.status === "CANCELLED"
    ) {
      return;
    }

    const now = new Date().toISOString();
    const hasScorekeepingEvents = hasActiveScorekeepingEvents(eventsForMatch);
    const nextStatus: MatchStatus = hasScorekeepingEvents
      ? selectedMatch.status
      : "SCHEDULED";
    const nextMatch: Match = {
      ...selectedMatch,
      clockRemainingSeconds: matchLengthSeconds,
      clockUpdatedAt: now,
      finishedAt: undefined,
      foulsA: hasScorekeepingEvents ? selectedMatch.foulsA : 0,
      foulsB: hasScorekeepingEvents ? selectedMatch.foulsB : 0,
      overtimeStartedAt: undefined,
      overtimeStartingScoreA: undefined,
      overtimeStartingScoreB: undefined,
      scoreA: hasScorekeepingEvents ? selectedMatch.scoreA : 0,
      scoreB: hasScorekeepingEvents ? selectedMatch.scoreB : 0,
      startedAt: hasScorekeepingEvents ? selectedMatch.startedAt : undefined,
      status:
        selectedMatch.status === "FINISHED" && hasScorekeepingEvents
          ? "PAUSED"
          : nextStatus,
      updatedAt: now,
      winnerTeamId: undefined,
    };

    saveMatches(
      matches.map((match) =>
        match.id === selectedMatch.id ? nextMatch : match,
      ),
    );

    if (!hasScorekeepingEvents) {
      saveMatchEvents(
        matchEvents.filter((event) => event.matchId !== selectedMatch.id),
      );
    }
  }

  function addPointEvent(player: Player, points: 1 | 2) {
    if (!selectedMatch || !canEdit) {
      return;
    }

    const nextPointEvent = createEvent(selectedMatch, {
      clock,
      jerseyNumber: getMatchJerseyNumber(player, matchJerseyMap),
      playerId: player.id,
      points,
      teamId: player.teamId,
      type: "POINT",
    });
    const nextEventsWithoutScore = [...eventsForMatch, nextPointEvent];
    const pointScore = calculateScore(nextEventsWithoutScore, selectedMatch);
    const scoredPointEvent = {
      ...nextPointEvent,
      scoreA: pointScore.teamA,
      scoreB: pointScore.teamB,
    };

    saveEventsAndMatch([...eventsForMatch, scoredPointEvent]);
  }

  function updatePlayerJerseyNumber(playerId: string, jerseyNumber: number) {
    if (!selectedMatch || !canControlSelectedMatch) {
      return;
    }

    const normalizedJerseyNumber = Math.max(
      0,
      Math.min(999, Math.trunc(jerseyNumber)),
    );
    const now = new Date().toISOString();
    const nextMatchJersey = {
      id: getMatchJerseyId(selectedMatch.id, playerId),
      jerseyNumber: normalizedJerseyNumber,
      matchId: selectedMatch.id,
      playerId,
      updatedAt: now,
    };

    saveMatchJerseys([
      ...matchJerseys.filter(
        (matchJersey) =>
          !(
            matchJersey.matchId === selectedMatch.id &&
            matchJersey.playerId === playerId
          ),
      ),
      nextMatchJersey,
    ]);
  }

  function addFoulEvent(player: Player) {
    if (!selectedMatch || !canEdit) {
      return;
    }

    saveEventsAndMatch([
      ...eventsForMatch,
      createEvent(selectedMatch, {
        clock,
        jerseyNumber: getMatchJerseyNumber(player, matchJerseyMap),
        playerId: player.id,
        teamId: player.teamId,
        type: "FOUL",
      }),
    ]);
  }

  function addAssistEvent(player: Player) {
    addPlayerTrackingEvent(player, "ASSIST");
  }

  function addReboundEvent(player: Player) {
    addPlayerTrackingEvent(player, "REBOUND");
  }

  function addPlayerTrackingEvent(
    player: Player,
    type: Extract<ScorekeepingEventType, "ASSIST" | "REBOUND">,
  ) {
    if (!selectedMatch || !canEdit) {
      return;
    }

    saveEventsAndMatch([
      ...eventsForMatch,
      createEvent(selectedMatch, {
        clock,
        jerseyNumber: getMatchJerseyNumber(player, matchJerseyMap),
        playerId: player.id,
        teamId: player.teamId,
        type,
      }),
    ]);
  }

  function deleteEvent(eventId: string) {
    if (!selectedMatch || !canControlSelectedMatch) {
      return;
    }

    if (!confirmDelete()) {
      return;
    }

    const targetEvent = eventsForMatch.find((event) => event.id === eventId);

    if (
      !targetEvent ||
      targetEvent.isDeleted ||
      !isScorekeepingEvent(targetEvent.type) ||
      (isFinished &&
        (!canReopenFinishedMatch || targetEvent.id !== lastEditableEvent?.id))
    ) {
      return;
    }

    const nextEvents = [
      ...eventsForMatch.map((event) =>
        event.id === eventId
          ? {
              ...event,
              isDeleted: true,
              updatedAt: new Date().toISOString(),
            }
          : event,
      ),
      createEvent(selectedMatch, {
        clock,
        deletedEventId: eventId,
        description: `Ispravljen unos: ${getEventText(
          targetEvent,
          teamMap,
          playerMap,
        )}`,
        type: "DELETE_EVENT",
      }),
    ];

    if (isFinished) {
      saveEventsAndMatch(nextEvents, "PAUSED", {
        baseMatches: rollbackKnockoutProgression(matches, selectedMatch.id),
      });
      return;
    }

    saveEventsAndMatch(nextEvents);
  }

  if (availableMatches.length === 0) {
    return (
      <div>
        <LiveHeader title="Rezultat uživo" />
        <EmptyState
          actionHref="/matches"
          actionText="Zakaži utakmicu"
          text="Rezultat uživo radi sa pravim utakmicama. Prvo napravi utakmicu u modulu Utakmice."
          title="Nema utakmica za rezultat uživo"
        />
      </div>
    );
  }

  if (!selectedMatch) {
    return (
      <div>
        <LiveHeader title="Rezultat uživo" />
        <EmptyState
          actionHref="/matches"
          actionText="Proveri utakmice"
          text="Nema utakmice koju možeš da izaberes za rezultat uživo."
          title="Nema utakmica"
        />
      </div>
    );
  }

  if (!teamA || !teamB) {
    return (
      <div>
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-medium text-[#94A3B8]">
              {tournament?.name ?? "Turnir"} /{" "}
              {getMatchRoundName(selectedMatch, matches)}
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-normal">
              Rezultat uživo
            </h2>
          </div>

          <div className="grid gap-3 lg:grid-cols-[150px_150px_130px_minmax(0,1fr)_repeat(4,92px)]">
            <select
              className="h-11 rounded-md border border-white/10 bg-[#111827] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#F97316]"
              onChange={(event) => {
                setSelectedTournamentId(event.target.value);
                setSelectedGroupName("ALL");
                setSelectedMatchStatusFilter("ALL");
                setSelectedMatchId("");
              }}
              value={activeTournamentId}
            >
              {tournamentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-md border border-white/10 bg-[#111827] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#F97316]"
              onChange={(event) => {
                setSelectedGroupName(event.target.value);
                setSelectedMatchId("");
              }}
              value={selectedGroupIsAvailable ? selectedGroupName : "ALL"}
            >
              <option value="ALL">Sve utakmice</option>
              {groupOptions.map((groupName) => (
                <option key={groupName} value={groupName}>
                  {groupName}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-md border border-white/10 bg-[#111827] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#F97316]"
              onChange={(event) => {
                setSelectedMatchStatusFilter(
                  event.target.value as MatchStatusFilter,
                );
                setSelectedMatchId("");
              }}
              value={
                selectedStatusFilterIsAvailable
                  ? selectedMatchStatusFilter
                  : "ALL"
              }
            >
              {(Object.entries(matchStatusFilterLabels) as Array<
                [MatchStatusFilter, string]
              >).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="h-11 min-w-0 rounded-md border border-white/10 bg-[#111827] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#F97316]"
              onChange={(event) => setSelectedMatchId(event.target.value)}
              value={selectedMatch.id}
            >
              {filteredMatches.map((match) => (
                <option key={match.id} value={match.id}>
                  {getMatchSelectLabel(match, matches, teamMap)}
                </option>
              ))}
            </select>
            <button
              className="h-11 rounded-md bg-[#22C55E] px-4 text-sm font-black text-[#052E16] transition disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#94A3B8]"
              disabled
              type="button"
            >
              Pokreni
            </button>
            <button
              className="h-11 rounded-md border border-white/15 px-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              disabled
              type="button"
            >
              Pauza
            </button>
            <button
              className="h-11 rounded-md border border-white/15 px-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              disabled
              type="button"
            >
              Nastavi
            </button>
            <button
              className="h-11 rounded-md border border-[#EF4444]/70 px-4 text-sm font-black text-[#FCA5A5] transition disabled:cursor-not-allowed disabled:opacity-40"
              disabled
              type="button"
            >
              Završi
            </button>
          </div>
        </header>

        <div className="mt-6 rounded-lg border border-dashed border-white/15 bg-[#111827] p-6 text-center">
          <p className="text-lg font-bold text-white">
            {getMatchRoundName(selectedMatch, matches)} čeka protivnike
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#94A3B8]">
            Ova utakmica će biti spremna kada se pobednici prethodne runde
            automatski upisu u stablo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5 xl:p-4 2xl:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(540px,600px)] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_minmax(600px,640px)]">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#94A3B8]">
              {tournament?.name ?? "Turnir"} /{" "}
              {getMatchRoundName(selectedMatch, matches, teams)}
            </p>
            <h2 className="mt-2 flex flex-wrap items-center gap-2 text-3xl font-black tracking-normal text-white sm:text-4xl xl:text-3xl 2xl:text-4xl">
              <span className="truncate">{teamA.name}</span>
              <span className="rounded-md border border-[#F97316]/40 bg-[#F97316]/10 px-2 py-1 text-base font-black text-[#FDBA74]">
                vs
              </span>
              <span className="truncate">{teamB.name}</span>
            </h2>
          </div>

          <div className="grid min-w-0 gap-2 md:grid-cols-[120px_125px_110px_minmax(185px,1fr)] md:justify-end 2xl:grid-cols-[130px_135px_120px_minmax(220px,420px)]">
            <select
              className="h-11 min-w-0 rounded-md border border-white/10 bg-[#0F172A] px-2 text-xs font-semibold text-white outline-none transition focus:border-[#F97316] sm:text-sm xl:h-10 xl:text-xs 2xl:h-11 2xl:text-sm"
              onChange={(event) => {
                setSelectedTournamentId(event.target.value);
                setSelectedGroupName("ALL");
                setSelectedMatchStatusFilter("ALL");
                setSelectedMatchId("");
              }}
              value={activeTournamentId}
            >
              {tournamentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              className="h-11 min-w-0 rounded-md border border-white/10 bg-[#0F172A] px-2 text-xs font-semibold text-white outline-none transition focus:border-[#F97316] sm:text-sm xl:h-10 xl:text-xs 2xl:h-11 2xl:text-sm"
              onChange={(event) => {
                setSelectedGroupName(event.target.value);
                setSelectedMatchId("");
              }}
              value={selectedGroupIsAvailable ? selectedGroupName : "ALL"}
            >
              <option value="ALL">Sve utakmice</option>
              {groupOptions.map((groupName) => (
                <option key={groupName} value={groupName}>
                  {groupName}
                </option>
              ))}
            </select>
            <select
              className="h-11 min-w-0 rounded-md border border-white/10 bg-[#0F172A] px-2 text-xs font-semibold text-white outline-none transition focus:border-[#F97316] sm:text-sm xl:h-10 xl:text-xs 2xl:h-11 2xl:text-sm"
              onChange={(event) => {
                setSelectedMatchStatusFilter(
                  event.target.value as MatchStatusFilter,
                );
                setSelectedMatchId("");
              }}
              value={
                selectedStatusFilterIsAvailable
                  ? selectedMatchStatusFilter
                  : "ALL"
              }
            >
              {(Object.entries(matchStatusFilterLabels) as Array<
                [MatchStatusFilter, string]
              >).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="h-11 min-w-0 rounded-md border border-white/10 bg-[#0F172A] px-2 text-xs font-semibold text-white outline-none transition focus:border-[#F97316] sm:text-sm xl:h-10 xl:text-xs 2xl:h-11 2xl:text-sm"
              onChange={(event) => setSelectedMatchId(event.target.value)}
              value={selectedMatch.id}
            >
              {filteredMatches.map((match) => (
                <option key={match.id} value={match.id}>
                  {getMatchSelectLabel(match, matches, teamMap)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4 2xl:mt-4 2xl:gap-3">
          <button
            className="h-12 rounded-md bg-[#22C55E] px-4 text-sm font-black text-[#052E16] transition hover:bg-[#86EFAC] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#94A3B8] xl:h-10 2xl:h-12"
            disabled={!canStartSelectedMatch}
            onClick={startMatch}
            type="button"
          >
            Pokreni
          </button>
          <button
            className="h-12 rounded-md border border-white/15 bg-[#0F172A] px-4 text-sm font-black text-white transition hover:border-[#FACC15] hover:text-[#FACC15] disabled:cursor-not-allowed disabled:opacity-40 xl:h-10 2xl:h-12"
            disabled={!canControlSelectedMatch || selectedMatch.status !== "LIVE"}
            onClick={pauseMatch}
            type="button"
          >
            Pauza
          </button>
          <button
            className="h-12 rounded-md border border-white/15 bg-[#0F172A] px-4 text-sm font-black text-white transition hover:border-[#22C55E] hover:text-[#86EFAC] disabled:cursor-not-allowed disabled:opacity-40 xl:h-10 2xl:h-12"
            disabled={!canControlSelectedMatch || selectedMatch.status !== "PAUSED"}
            onClick={resumeMatch}
            type="button"
          >
            Nastavi
          </button>
          <button
            className="h-12 rounded-md border border-[#EF4444]/70 bg-[#0F172A] px-4 text-sm font-black text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 xl:h-10 2xl:h-12"
            disabled={!canOpenEndDecision}
            onClick={showMatchDecision}
            type="button"
          >
            Završi
          </button>
        </div>

        {matchLock.lockedByOtherDevice && (
          <button
            className="mt-3 h-11 w-full rounded-md border border-[#F97316]/70 bg-[#F97316]/10 px-4 text-sm font-black text-[#FDBA74] transition hover:bg-[#F97316] hover:text-[#111827]"
            onClick={matchLock.takeControl}
            type="button"
          >
            Preuzmi kontrolu ove utakmice
          </button>
        )}
      </header>

      <MatchDecisionPanel
        decision={endDecision}
        isOvertime={isOvertime}
        onConfirmFinish={finishMatch}
        onDismiss={dismissEndDecision}
        onStartOvertime={startOvertime}
        remainingSeconds={remainingSeconds}
        score={score}
        show={showEndDecision}
      />

      <section className="mt-4 grid gap-3 xl:grid-cols-[minmax(320px,1fr)_minmax(220px,240px)_minmax(320px,1fr)] xl:items-start 2xl:mt-5 2xl:gap-4 2xl:grid-cols-[minmax(320px,1fr)_minmax(260px,300px)_minmax(320px,1fr)]">
        <TeamScorePanel
          canEdit={canEdit}
          canUpdateJerseyNumbers={canControlSelectedMatch}
          fouls={fouls.teamA}
          matchId={selectedMatch.id}
          onAddFoul={addFoulEvent}
          onAddAssist={addAssistEvent}
          onAddPoint={addPointEvent}
          onAddRebound={addReboundEvent}
          onUpdateJerseyNumber={updatePlayerJerseyNumber}
          matchJerseyMap={matchJerseyMap}
          playerStats={playerStats}
          players={playersA}
          score={score.teamA}
          sideLabel="Ekipa A"
          team={teamA}
        />

        <div className="order-first xl:sticky xl:top-4 xl:order-none">
          <Scoreboard
            canResetClock={canResetClock}
            clock={clock}
            fouls={fouls}
            isOvertime={isOvertime}
            matchStatus={selectedMatch.status}
            onResetClock={resetMatchClock}
            score={score}
            teamAName={teamA.name}
            teamBName={teamB.name}
          />
        </div>

        <TeamScorePanel
          canEdit={canEdit}
          canUpdateJerseyNumbers={canControlSelectedMatch}
          fouls={fouls.teamB}
          matchId={selectedMatch.id}
          onAddFoul={addFoulEvent}
          onAddAssist={addAssistEvent}
          onAddPoint={addPointEvent}
          onAddRebound={addReboundEvent}
          onUpdateJerseyNumber={updatePlayerJerseyNumber}
          matchJerseyMap={matchJerseyMap}
          playerStats={playerStats}
          players={playersB}
          score={score.teamB}
          sideLabel="Ekipa B"
          team={teamB}
        />
      </section>

      <EventLog
        canEdit={canControlSelectedMatch}
        canUndoLast={
          canControlSelectedMatch &&
          Boolean(lastEditableEvent) &&
          (!isFinished || canReopenFinishedMatch)
        }
        events={eventsForMatch}
        isFinished={Boolean(isFinished)}
        lastEditableEvent={lastEditableEvent}
        match={selectedMatch}
        onDeleteEvent={deleteEvent}
        playerMap={playerMap}
        teamMap={teamMap}
      />
    </div>
  );
}

function LiveHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-white/10 pb-5">
      <p className="text-sm font-medium text-[#94A3B8]">Vođenje rezultata</p>
      <h2 className="mt-1 text-3xl font-bold tracking-normal">{title}</h2>
    </header>
  );
}

function TeamScorePanel({
  canEdit,
  canUpdateJerseyNumbers,
  fouls,
  matchId,
  matchJerseyMap,
  onAddAssist,
  onAddFoul,
  onAddPoint,
  onAddRebound,
  onUpdateJerseyNumber,
  playerStats,
  players,
  score,
  sideLabel,
  team,
}: {
  canEdit: boolean;
  canUpdateJerseyNumbers: boolean;
  fouls: number;
  matchId: string;
  matchJerseyMap: Map<string, number>;
  onAddAssist: (player: Player) => void;
  onAddFoul: (player: Player) => void;
  onAddPoint: (player: Player, points: 1 | 2) => void;
  onAddRebound: (player: Player) => void;
  onUpdateJerseyNumber: (playerId: string, jerseyNumber: number) => void;
  playerStats: Record<string, LivePlayerStats>;
  players: Player[];
  score: number;
  sideLabel: "Ekipa A" | "Ekipa B";
  team: Team;
}) {
  const foulWarning = fouls >= foulLimit;
  const sideKey = sideLabel === "Ekipa A" ? "team-a" : "team-b";
  const [temporaryNicknames, setTemporaryNicknames] = useState<
    Record<string, Record<string, string>>
  >({});
  const nicknamesForMatch = temporaryNicknames[matchId] ?? {};

  function updateTemporaryNickname(playerId: string, nickname: string) {
    setTemporaryNicknames((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] ?? {}),
        [playerId]: nickname,
      },
    }));
  }

  return (
    <article className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5 xl:p-3 2xl:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(150px,auto)] sm:items-center xl:grid-cols-[minmax(0,1fr)_120px] xl:gap-2 2xl:grid-cols-[minmax(0,1fr)_minmax(150px,auto)] 2xl:gap-4">
        <div className="flex min-w-0 items-center gap-3 xl:gap-2 2xl:gap-3">
          <span className="shrink-0 rounded-md border border-[#F97316]/35 bg-[#F97316]/10 px-2 py-1 text-xs font-black text-[#FDBA74]">
            {sideLabel}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-2xl font-black tracking-normal text-white xl:text-lg 2xl:text-2xl">
              {team.name}
            </h3>
            <p className="mt-1 truncate text-sm font-semibold text-[#94A3B8] xl:text-xs 2xl:text-sm">
              {team.city}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-white/10 text-center">
          <div className="bg-[#0F172A] px-4 py-2.5 xl:px-2 xl:py-2 2xl:px-4 2xl:py-2.5">
            <p className="text-xs text-[#94A3B8]">Rezultat</p>
            <p
              className="mt-1 text-3xl font-black leading-none text-white xl:text-2xl 2xl:text-3xl"
              data-testid={`score-${sideKey}`}
            >
              {score}
            </p>
          </div>
          <div className="border-l border-white/10 bg-[#0F172A] px-4 py-2.5 xl:px-2 xl:py-2 2xl:px-4 2xl:py-2.5">
            <p className="text-xs text-[#94A3B8]">Faulovi</p>
            <p
              className={`mt-1 text-3xl font-black leading-none xl:text-2xl 2xl:text-3xl ${
                foulWarning ? "text-[#EF4444]" : "text-[#FACC15]"
              }`}
              data-testid={`fouls-${sideKey}`}
            >
              {fouls}
            </p>
          </div>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-white/15 bg-[#111827] p-4 text-center">
          <p className="text-sm font-bold text-white">Nema igrača</p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Dodaj igrače da bi imao dugmad za poene i statistiku.
          </p>
          <Link
            className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-white/15 px-3 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
            href="/players"
          >
            Igrači
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 xl:mt-3 xl:gap-2 2xl:mt-4">
          {players.map((player) => {
            const stats =
              playerStats[player.id] ??
              ({ assists: 0, fouls: 0, points: 0, rebounds: 0 } satisfies LivePlayerStats);

            return (
              <div
                className="min-w-0 rounded-lg border border-white/10 bg-[#0F172A] p-3 transition hover:border-[#F97316]/45 xl:p-2 2xl:p-2.5"
                key={player.id}
              >
                <div className="grid gap-3 xl:grid-cols-[minmax(125px,0.85fr)_minmax(0,1.15fr)] xl:grid-rows-[auto_auto] xl:gap-x-2 xl:gap-y-1 2xl:grid-cols-[minmax(170px,0.9fr)_minmax(230px,1.1fr)]">
                  <div className="flex min-w-0 items-start gap-3 xl:row-span-2 xl:gap-2">
                    <JerseyNumberField
                      disabled={!canUpdateJerseyNumbers}
                      onUpdate={(jerseyNumber) =>
                        onUpdateJerseyNumber(player.id, jerseyNumber)
                      }
                      value={getMatchJerseyNumber(player, matchJerseyMap)}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-lg font-black leading-tight text-white xl:line-clamp-2 xl:min-h-8 xl:text-sm 2xl:text-base"
                        title={getPlayerDisplayName(player)}
                      >
                        {getPlayerDisplayName(player)}
                      </p>
                      <TemporaryNicknameField
                        playerName={getPlayerDisplayName(player)}
                        onUpdate={(nickname) =>
                          updateTemporaryNickname(player.id, nickname)
                        }
                        value={nicknamesForMatch[player.id] ?? ""}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-4 xl:col-start-2 xl:row-start-1 xl:grid-cols-2 xl:gap-1 xl:text-[10px]">
                    <span className="truncate rounded-md bg-[#F97316]/10 px-1.5 py-1 text-center text-[#FDBA74]">
                      {stats.points} poena
                    </span>
                    <span className="truncate rounded-md bg-[#FACC15]/10 px-1.5 py-1 text-center text-[#FDE68A]">
                      {stats.fouls} faulova
                    </span>
                    <span className="truncate rounded-md bg-[#38BDF8]/10 px-1.5 py-1 text-center text-[#7DD3FC]">
                      {stats.assists} asist.
                    </span>
                    <span className="truncate rounded-md bg-[#22C55E]/10 px-1.5 py-1 text-center text-[#86EFAC]">
                      {stats.rebounds} skok.
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2 xl:col-start-2 xl:row-start-2 xl:gap-1">
                    <button
                      className="h-12 rounded-md bg-[#F97316] px-2 text-lg font-black text-[#111827] transition hover:bg-[#FACC15] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#64748B] xl:h-9 xl:px-1 xl:text-sm 2xl:text-base"
                      data-testid={`point-${player.id}-1`}
                      disabled={!canEdit}
                      onClick={() => onAddPoint(player, 1)}
                      type="button"
                    >
                      +1
                    </button>
                    <button
                      className="h-12 rounded-md bg-[#F97316] px-2 text-lg font-black text-[#111827] transition hover:bg-[#FACC15] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#64748B] xl:h-9 xl:px-1 xl:text-sm 2xl:text-base"
                      data-testid={`point-${player.id}-2`}
                      disabled={!canEdit}
                      onClick={() => onAddPoint(player, 2)}
                      type="button"
                    >
                      +2
                    </button>
                    <button
                      className="h-12 rounded-md border border-[#FACC15]/60 px-2 text-xs font-black text-[#FACC15] transition hover:bg-[#FACC15] hover:text-[#111827] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-[#64748B] xl:h-9 xl:px-0.5 xl:text-[10px] 2xl:text-[11px]"
                      data-testid={`foul-${player.id}`}
                      disabled={!canEdit}
                      onClick={() => onAddFoul(player)}
                      type="button"
                    >
                      Faul
                    </button>
                    <button
                      className="h-12 rounded-md border border-[#38BDF8]/60 px-2 text-xs font-black text-[#7DD3FC] transition hover:bg-[#38BDF8] hover:text-[#082F49] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-[#64748B] xl:h-9 xl:px-0.5 xl:text-[10px] 2xl:text-[11px]"
                      data-testid={`assist-${player.id}`}
                      disabled={!canEdit}
                      onClick={() => onAddAssist(player)}
                      type="button"
                    >
                      Asist
                    </button>
                    <button
                      className="h-12 rounded-md border border-[#22C55E]/60 px-2 text-xs font-black text-[#86EFAC] transition hover:bg-[#22C55E] hover:text-[#052E16] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-[#64748B] xl:h-9 xl:px-0.5 xl:text-[10px] 2xl:text-[11px]"
                      data-testid={`rebound-${player.id}`}
                      disabled={!canEdit}
                      onClick={() => onAddRebound(player)}
                      type="button"
                    >
                      Skok
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function JerseyNumberField({
  disabled,
  onUpdate,
  value,
}: {
  disabled: boolean;
  onUpdate: (jerseyNumber: number) => void;
  value?: number;
}) {
  function commitValue(input: HTMLInputElement) {
    if (!input.value.trim()) {
      return;
    }

    const nextValue = Number(input.value);

    if (!Number.isFinite(nextValue)) {
      input.value = value?.toString() ?? "";
      return;
    }

    onUpdate(nextValue);
  }

  return (
    <label className="shrink-0">
      <span className="block text-[10px] font-black uppercase text-[#94A3B8]">
        Dres
      </span>
      <input
        className="mt-1 h-14 w-20 appearance-none rounded-md border border-[#F97316]/50 bg-[#111827] px-2 text-center text-2xl font-black text-[#FACC15] outline-none transition focus:border-[#FACC15] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-[#64748B] xl:h-11 xl:w-16 xl:text-xl 2xl:h-14 2xl:w-20 2xl:text-2xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        defaultValue={value ?? ""}
        disabled={disabled}
        inputMode="numeric"
        key={value ?? "empty"}
        max={999}
        min={0}
        onBlur={(event) => commitValue(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        type="number"
      />
    </label>
  );
}

function TemporaryNicknameField({
  onUpdate,
  playerName,
  value,
}: {
  onUpdate: (nickname: string) => void;
  playerName: string;
  value: string;
}) {
  return (
    <label className="mt-2 block w-full max-w-[240px] xl:mt-1">
      <span className="block text-[10px] font-black uppercase text-[#94A3B8] xl:hidden">
        Nadimak
      </span>
      <input
        aria-label={`Nadimak za ${playerName}`}
        autoComplete="off"
        className="mt-1 h-10 w-full rounded-md border border-[#F97316]/50 bg-[#111827] px-3 text-sm font-bold text-white outline-none transition placeholder:text-[#64748B] focus:border-[#FACC15] xl:mt-0 xl:h-8 xl:px-2 xl:text-xs 2xl:h-9 2xl:text-sm"
        maxLength={30}
        onChange={(event) => onUpdate(event.target.value)}
        placeholder="Nadimak"
        type="text"
        value={value}
      />
    </label>
  );
}

function MatchDecisionPanel({
  decision,
  isOvertime,
  onConfirmFinish,
  onDismiss,
  onStartOvertime,
  remainingSeconds,
  score,
  show,
}: {
  decision?: MatchEndDecision;
  isOvertime: boolean;
  onConfirmFinish: () => void;
  onDismiss: () => void;
  onStartOvertime: () => void;
  remainingSeconds: number;
  score: ScoreBySide;
  show: boolean;
}) {
  if (!show || !decision) {
    return null;
  }

  const title =
    decision === "OVERTIME"
      ? "Rezultat je nerešen"
      : isOvertime
        ? "Proverite kraj produžetka"
        : remainingSeconds === 0
          ? "Regularno vreme je isteklo"
          : "Dostignut je limit od 21 poena";

  return (
    <section
      aria-labelledby="match-decision-title"
      className="mt-4 rounded-lg border border-[#FACC15]/45 bg-[#1C1917] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.3)]"
      role="dialog"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase text-[#FACC15]">
            Potvrda zapisničara
          </p>
          <h3
            className="mt-1 text-xl font-black text-white"
            id="match-decision-title"
          >
            {title}
          </h3>
          <p className="mt-2 text-sm text-[#CBD5E1]">
            Trenutni rezultat je {score.teamA}:{score.teamB}. Možete prvo
            dodati propušten poen, faul, asistenciju ili skok.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            className="h-11 rounded-md border border-white/20 px-4 text-sm font-black text-white transition hover:border-[#F97316] hover:text-[#FDBA74]"
            onClick={onDismiss}
            type="button"
          >
            {decision === "OVERTIME" ? "Ne još, nastavi unos" : "Nastavi unos"}
          </button>
          <button
            className="h-11 rounded-md bg-[#F97316] px-4 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
            onClick={
              decision === "OVERTIME" ? onStartOvertime : onConfirmFinish
            }
            type="button"
          >
            {decision === "OVERTIME"
              ? "Pokreni produžetak"
              : "Potvrdi kraj utakmice"}
          </button>
        </div>
      </div>
    </section>
  );
}

function Scoreboard({
  canResetClock,
  clock,
  fouls,
  isOvertime,
  matchStatus,
  onResetClock,
  score,
  teamAName,
  teamBName,
}: {
  canResetClock: boolean;
  clock: string;
  fouls: ScoreBySide;
  isOvertime: boolean;
  matchStatus: MatchStatus;
  onResetClock: () => void;
  score: ScoreBySide;
  teamAName: string;
  teamBName: string;
}) {
  return (
    <aside className="flex min-h-[420px] flex-col justify-between rounded-lg border border-[#F97316]/35 bg-[#0B1220] p-4 text-center shadow-[0_18px_40px_rgba(2,6,23,0.28)] 2xl:min-h-[440px] 2xl:p-5">
      <div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          <span />
          <span
            className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${statusBadge(matchStatus)}`}
          >
            {isOvertime ? "Produžetak" : matchStatusLabel(matchStatus)}
          </span>
          <button
            className="justify-self-end rounded-md border border-white/15 px-3 py-1 text-xs font-black text-[#CBD5E1] transition hover:border-[#FACC15] hover:text-[#FACC15] disabled:cursor-not-allowed disabled:opacity-35"
            disabled={!canResetClock}
            onClick={onResetClock}
            type="button"
          >
            Reset
          </button>
        </div>

        <p className="mt-6 text-xs font-black uppercase text-[#94A3B8]">
          {isOvertime ? "Prvi do" : "Vreme"}
        </p>
        <p
          className={`${isOvertime ? "text-4xl" : "text-6xl"} mt-1 font-black tracking-normal text-[#FACC15]`}
        >
          {isOvertime ? `${overtimePointsToWin} poena` : clock}
        </p>
      </div>

      <div className="my-7">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
          <div className="min-w-0">
            <p className="mb-2 truncate text-xs font-black uppercase text-[#94A3B8]">
              {teamAName}
            </p>
            <p
              className="text-7xl font-black tracking-normal text-white"
              data-testid="main-score-a"
            >
              {score.teamA}
            </p>
          </div>
          <span className="pb-3 text-5xl font-black text-[#F97316]">:</span>
          <div className="min-w-0">
            <p className="mb-2 truncate text-xs font-black uppercase text-[#94A3B8]">
              {teamBName}
            </p>
            <p
              className="text-7xl font-black tracking-normal text-white"
              data-testid="main-score-b"
            >
              {score.teamB}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Faulovi A" value={fouls.teamA.toString()} />
        <Metric label="Faulovi B" value={fouls.teamB.toString()} />
      </div>
    </aside>
  );
}

function EventLog({
  canEdit,
  canUndoLast,
  events,
  isFinished,
  lastEditableEvent,
  match,
  onDeleteEvent,
  playerMap,
  teamMap,
}: {
  canEdit: boolean;
  canUndoLast: boolean;
  events: MatchEvent[];
  isFinished: boolean;
  lastEditableEvent?: MatchEvent;
  match: Match;
  onDeleteEvent: (eventId: string) => void;
  playerMap: Map<string, Player>;
  teamMap: Map<string, Team>;
}) {
  const scoreByEventId = buildScoreByEventId(events, match);
  const orderedEvents = [...events].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const activeEventCount = orderedEvents.filter((event) => !event.isDeleted)
    .length;

  return (
    <section className="mt-5 rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-3xl font-black tracking-normal">Zapisnik</h3>
          <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
            {activeEventCount} unosa
          </p>
        </div>
        <button
          className="h-11 rounded-md border border-white/15 bg-[#0F172A] px-4 text-sm font-black text-white transition hover:border-[#F97316] hover:text-[#FACC15] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canUndoLast}
          onClick={() => lastEditableEvent && onDeleteEvent(lastEditableEvent.id)}
          type="button"
        >
          Ponisti poslednje
        </button>
      </div>

      {orderedEvents.length === 0 ? (
        <p className="mt-5 rounded-md border border-dashed border-white/15 bg-[#0F172A] px-4 py-8 text-center text-sm font-bold text-[#94A3B8]">
          Zapisnik je prazan dok ne startujes utakmicu ili uneses prvi događaj.
        </p>
      ) : (
        <div
          className="mt-5 max-h-[680px] overflow-y-auto pr-1"
          data-testid="event-log"
        >
          <div className="sticky top-0 z-10 hidden grid-cols-[92px_minmax(0,1.3fr)_minmax(0,1fr)_120px_120px_96px] gap-3 border-b border-white/10 bg-[#111827] px-3 pb-3 text-xs font-black uppercase text-[#94A3B8] lg:grid">
            <span>Vreme</span>
            <span>Igrač</span>
            <span>Ekipa</span>
            <span className="text-center">Događaj</span>
            <span className="text-center">Rezultat</span>
            <span></span>
          </div>

          <div className="divide-y divide-white/10">
            {orderedEvents.map((event) => {
              const canDelete =
                canEdit &&
                !isFinished &&
                !event.isDeleted &&
                isScorekeepingEvent(event.type);
              const player = event.playerId
                ? playerMap.get(event.playerId)
                : undefined;
              const team = event.teamId ? teamMap.get(event.teamId) : undefined;
              const scoreAfter = scoreByEventId.get(event.id);
              const scoreText =
                event.scoreA !== undefined && event.scoreB !== undefined
                  ? `${event.scoreA}:${event.scoreB}`
                  : scoreAfter
                    ? `${scoreAfter.teamA}:${scoreAfter.teamB}`
                    : `${match.scoreA}:${match.scoreB}`;
              const isPoint = event.type === "POINT";

              return (
                <article
                  className={`py-2 ${
                    event.isDeleted ? "opacity-50" : ""
                  }`}
                  key={event.id}
                >
                  <div
                    className={`grid gap-3 rounded-md border border-l-4 bg-[#0F172A] p-3 lg:grid-cols-[92px_minmax(0,1.3fr)_minmax(0,1fr)_120px_120px_96px] lg:items-center ${getEventBorderClass(event)}`}
                  >
                    <div className="rounded-md bg-white/[0.04] px-3 py-2 text-center">
                      <p className="text-[10px] font-bold uppercase text-[#94A3B8] lg:hidden">
                        Vreme
                      </p>
                      <p className="text-xl font-black text-[#FACC15]">
                        {event.clock}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase text-[#94A3B8] lg:hidden">
                        Igrač
                      </p>
                      <p
                        className={`truncate text-base font-black text-white sm:text-lg ${
                          event.isDeleted ? "line-through" : ""
                        }`}
                      >
                        {player
                          ? formatPlayerWithJersey(
                              player,
                              event.jerseyNumber ??
                                (player.jerseyNumber > 0
                                  ? player.jerseyNumber
                                  : undefined),
                            )
                          : getEventText(event, teamMap, playerMap)}
                      </p>
                      <p className="mt-1 text-xs text-[#94A3B8]">
                        {formatEventTime(event.createdAt)}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase text-[#94A3B8] lg:hidden">
                        Ekipa
                      </p>
                      <p className="truncate text-sm font-black text-white">
                        {team?.name ?? "Bez ekipe"}
                      </p>
                    </div>

                    <div
                      className={`rounded-md px-3 py-2 text-center text-xl font-black ${
                        isPoint
                          ? "bg-[#F97316]/15 text-[#FDBA74]"
                          : getTrackingEventClass(event)
                      }`}
                    >
                      {isPoint ? `+${event.points ?? 0}` : getTrackingEventLabel(event)}
                    </div>

                    <div className="rounded-md bg-[#22C55E]/10 px-3 py-2 text-center text-xl font-black text-[#86EFAC]">
                      {scoreText}
                    </div>

                    {canDelete ? (
                      <button
                        className="h-11 rounded-md border border-white/15 px-3 text-sm font-bold text-[#CBD5E1] transition hover:border-[#EF4444] hover:text-[#FCA5A5]"
                        onClick={() => onDeleteEvent(event.id)}
                        type="button"
                      >
                        Obriši
                      </button>
                    ) : (
                      <span className="hidden lg:block" />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function getEventBorderClass(event: MatchEvent) {
  if (event.isDeleted) {
    return "border-white/10 border-l-[#64748B]";
  }

  if (event.type === "POINT") {
    return "border-white/10 border-l-[#F97316]";
  }

  if (event.type === "FOUL") {
    return "border-white/10 border-l-[#FACC15]";
  }

  if (event.type === "ASSIST") {
    return "border-white/10 border-l-[#38BDF8]";
  }

  if (event.type === "REBOUND") {
    return "border-white/10 border-l-[#22C55E]";
  }

  if (event.type === "DELETE_EVENT") {
    return "border-white/10 border-l-[#EF4444]";
  }

  return "border-white/10 border-l-[#38BDF8]";
}

function getTrackingEventClass(event: MatchEvent) {
  if (event.type === "FOUL") {
    return "bg-[#FACC15]/15 text-[#FDE68A]";
  }

  if (event.type === "ASSIST") {
    return "bg-[#38BDF8]/15 text-[#7DD3FC]";
  }

  if (event.type === "REBOUND") {
    return "bg-[#22C55E]/15 text-[#86EFAC]";
  }

  return "bg-white/[0.04] text-[#CBD5E1]";
}

function getTrackingEventLabel(event: MatchEvent) {
  if (event.type === "FOUL") {
    return "Faul";
  }

  if (event.type === "ASSIST") {
    return "Asist";
  }

  if (event.type === "REBOUND") {
    return "Skok";
  }

  return "-";
}

function buildScoreByEventId(events: MatchEvent[], match: Match) {
  const score: ScoreBySide = { teamA: 0, teamB: 0 };
  const scoreByEventId = new Map<string, ScoreBySide>();

  for (const event of [...events].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    if (event.type === "POINT" && event.teamId && !event.isDeleted) {
      if (event.teamId === match.teamAId) {
        score.teamA += event.points ?? 0;
      }

      if (event.teamId === match.teamBId) {
        score.teamB += event.points ?? 0;
      }
    }

    scoreByEventId.set(event.id, { ...score });
  }

  return scoreByEventId;
}

function Metric({
  label,
  value,
  valueClassName = "text-white",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-xs text-[#94A3B8]">{label}</p>
      <p className={`mt-1 truncate text-xl font-black ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({
  actionHref,
  actionText,
  text,
  title,
}: {
  actionHref: string;
  actionText: string;
  text: string;
  title: string;
}) {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-white/15 bg-[#111827] p-6 text-center">
      <p className="text-lg font-bold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#94A3B8]">{text}</p>
      <Link
        className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#F97316] px-3 text-sm font-black text-[#111827] transition hover:bg-[#FACC15]"
        href={actionHref}
      >
        {actionText}
      </Link>
    </div>
  );
}

function getMatchRemainingSeconds(
  match: Match,
  nowMs: number,
  events: MatchEvent[] = [],
) {
  const storedRemainingSeconds = normalizeClockSeconds(
    match.clockRemainingSeconds,
  );
  const lastClockSnapshot = getLastClockSnapshot(events);
  const baseRemainingSeconds =
    storedRemainingSeconds ??
    lastClockSnapshot?.remainingSeconds ??
    matchLengthSeconds;

  if (match.status !== "LIVE") {
    return baseRemainingSeconds;
  }

  const updatedAt =
    storedRemainingSeconds !== undefined
      ? match.clockUpdatedAt
      : lastClockSnapshot?.createdAt ?? match.startedAt;
  const updatedAtMs = updatedAt ? Date.parse(updatedAt) : Number.NaN;

  if (!Number.isFinite(updatedAtMs)) {
    return baseRemainingSeconds;
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000));

  return Math.max(0, baseRemainingSeconds - elapsedSeconds);
}

function getLastClockSnapshot(events: MatchEvent[]) {
  for (const event of [...events].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )) {
    const remainingSeconds = parseClockSeconds(event.clock);

    if (remainingSeconds !== undefined) {
      return {
        createdAt: event.createdAt,
        remainingSeconds,
      };
    }
  }

  return undefined;
}

function normalizeClockSeconds(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(matchLengthSeconds, Math.trunc(value)));
}

function getOvertimeScore(score: ScoreBySide, match: Match): ScoreBySide {
  return {
    teamA: Math.max(0, score.teamA - (match.overtimeStartingScoreA ?? score.teamA)),
    teamB: Math.max(0, score.teamB - (match.overtimeStartingScoreB ?? score.teamB)),
  };
}

function parseClockSeconds(value: string) {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());

  if (!match) {
    return undefined;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function hasActiveScorekeepingEvents(events: MatchEvent[]) {
  return events.some(
    (event) => !event.isDeleted && isScorekeepingEvent(event.type),
  );
}

function isScorekeepingEvent(type: MatchEventType): type is ScorekeepingEventType {
  return (
    type === "POINT" ||
    type === "FOUL" ||
    type === "ASSIST" ||
    type === "REBOUND"
  );
}

function calculateScore(events: MatchEvent[], match: Match): ScoreBySide {
  return events.reduce<ScoreBySide>(
    (score, event) => {
      if (event.type !== "POINT" || !event.teamId || event.isDeleted) {
        return score;
      }

      if (event.teamId === match.teamAId) {
        score.teamA += event.points ?? 0;
      }

      if (event.teamId === match.teamBId) {
        score.teamB += event.points ?? 0;
      }

      return score;
    },
    { teamA: 0, teamB: 0 },
  );
}

function calculateFouls(events: MatchEvent[], match: Match): ScoreBySide {
  return events.reduce<ScoreBySide>(
    (fouls, event) => {
      if (event.type !== "FOUL" || !event.teamId || event.isDeleted) {
        return fouls;
      }

      if (event.teamId === match.teamAId) {
        fouls.teamA += 1;
      }

      if (event.teamId === match.teamBId) {
        fouls.teamB += 1;
      }

      return fouls;
    },
    { teamA: 0, teamB: 0 },
  );
}

function calculatePlayerStats(
  events: MatchEvent[],
): Record<string, LivePlayerStats> {
  return events.reduce<Record<string, LivePlayerStats>>(
    (stats, event) => {
      if (!event.playerId || event.isDeleted) {
        return stats;
      }

      stats[event.playerId] ??= {
        assists: 0,
        fouls: 0,
        points: 0,
        rebounds: 0,
      };

      if (event.type === "POINT") {
        stats[event.playerId].points += event.points ?? 0;
      }

      if (event.type === "FOUL") {
        stats[event.playerId].fouls += 1;
      }

      if (event.type === "ASSIST") {
        stats[event.playerId].assists += 1;
      }

      if (event.type === "REBOUND") {
        stats[event.playerId].rebounds += 1;
      }

      return stats;
    },
    {},
  );
}

function createEvent(
  match: Match,
  event: Omit<
    MatchEvent,
    | "createdAt"
    | "id"
    | "isDeleted"
    | "matchId"
    | "tournamentId"
    | "updatedAt"
  >,
): MatchEvent {
  const now = new Date().toISOString();

  return {
    ...event,
    createdAt: now,
    id: createId("event"),
    isDeleted: false,
    matchId: match.id,
    tournamentId: match.tournamentId,
    updatedAt: now,
  };
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secondsLeft = (seconds % 60).toString().padStart(2, "0");

  return `${minutes}:${secondsLeft}`;
}

function getEventText(
  event: MatchEvent,
  teamMap: Map<string, Team>,
  playerMap: Map<string, Player>,
) {
  if (event.description) {
    return event.description;
  }

  const playerName = event.playerId
    ? getPlayerName(event.playerId, playerMap, event.jerseyNumber)
    : "Bez igrača";
  const teamName = event.teamId ? getTeamName(event.teamId, teamMap) : "";

  if (event.type === "POINT") {
    return `${playerName}, ${teamName}, +${event.points}`;
  }

  if (event.type === "FOUL") {
    return `${playerName}, ${teamName}, faul`;
  }

  if (event.type === "ASSIST") {
    return `${playerName}, ${teamName}, asistencija`;
  }

  if (event.type === "REBOUND") {
    return `${playerName}, ${teamName}, skok`;
  }

  if (event.type === "DELETE_EVENT") {
    return "Ispravka događaja";
  }

  return event.type;
}

function getPlayerName(
  playerId: string,
  playerMap: Map<string, Player>,
  jerseyNumber?: number,
) {
  const player = playerMap.get(playerId);

  if (!player) {
    return "Nepoznat igrač";
  }

  return formatPlayerWithJersey(
    player,
    jerseyNumber ?? (player.jerseyNumber > 0 ? player.jerseyNumber : undefined),
  );
}

function comparePlayersForLiveScore(
  playerA: Player,
  playerB: Player,
  matchJerseyMap: Map<string, number>,
) {
  const jerseyA = getMatchJerseyNumber(playerA, matchJerseyMap);
  const jerseyB = getMatchJerseyNumber(playerB, matchJerseyMap);

  if (jerseyA !== undefined && jerseyB !== undefined && jerseyA !== jerseyB) {
    return jerseyA - jerseyB;
  }

  if (jerseyA !== undefined) {
    return -1;
  }

  if (jerseyB !== undefined) {
    return 1;
  }

  return getPlayerDisplayName(playerA).localeCompare(
    getPlayerDisplayName(playerB),
  );
}

function getMatchJerseyNumber(
  player: Player,
  matchJerseyMap: Map<string, number>,
) {
  const matchJerseyNumber = matchJerseyMap.get(player.id);

  if (
    typeof matchJerseyNumber === "number" &&
    Number.isFinite(matchJerseyNumber)
  ) {
    return matchJerseyNumber;
  }

  if (player.jerseyNumber > 0) {
    return player.jerseyNumber;
  }

  return undefined;
}

function formatPlayerWithJersey(player: Player, jerseyNumber?: number) {
  const playerName = getPlayerDisplayName(player);

  if (typeof jerseyNumber === "number" && Number.isFinite(jerseyNumber)) {
    return `#${jerseyNumber} ${playerName}`;
  }

  return playerName;
}

function getTeamName(teamId: string, teamMap: Map<string, Team>) {
  if (!teamId) {
    return "Čeka protivnika";
  }

  return teamMap.get(teamId)?.name ?? "Nepoznata ekipa";
}

function getWinnerTeamId(score: ScoreBySide, match: Match) {
  if (score.teamA === score.teamB) {
    return undefined;
  }

  return score.teamA > score.teamB ? match.teamAId : match.teamBId;
}

function getWinnerText(
  score: ScoreBySide,
  match: Match,
  teamMap: Map<string, Team>,
) {
  const winnerTeamId = getWinnerTeamId(score, match);

  if (!winnerTeamId) {
    return "Rezultat je izjednačen.";
  }

  return `Pobednik: ${getTeamName(winnerTeamId, teamMap)}.`;
}

function formatEventTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("sr-RS", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Belgrade",
  }).format(date);
}

function getMatchFilterName(match: Match, matches: Match[], teams: Team[]) {
  const phase = getMatchPhase(match);

  if (phase === "GROUP_STAGE") {
    return getMatchGroupName(match, teams);
  }

  if (phase === "FINAL") {
    return "Finale";
  }

  if (phase === "THIRD_PLACE") {
    return "Za treće mesto";
  }

  return phase === "SEMI_FINAL" ? "Polufinale" : "Četvrtfinale";
}
function getMatchRoundName(match: Match, matches: Match[], teams?: Team[]) {
  const phase = getMatchPhase(match);

  if (phase === "GROUP_STAGE") {
    return teams ? getMatchGroupName(match, teams) : "Grupna faza";
  }

  if (phase === "FINAL") {
    return "Finale";
  }

  if (phase === "THIRD_PLACE") {
    return "Za treće mesto";
  }

  const phaseName = phase === "SEMI_FINAL" ? "Polufinale" : "Četvrtfinale";
  return phaseName + " " + (getPhaseMatchIndex(match, matches) + 1);
}
function getMatchSelectLabel(
  match: Match,
  matches: Match[],
  teamMap: Map<string, Team>,
) {
  return `${getMatchRoundName(match, matches)} / ${getTeamName(
    match.teamAId,
    teamMap,
  )} protiv ${getTeamName(match.teamBId, teamMap)}`;
}

function getPhaseMatchIndex(match: Match, matches: Match[]) {
  const phase = getMatchPhase(match);

  return Math.max(
    0,
    matches
      .filter(
        (item) =>
          item.tournamentId === match.tournamentId && getMatchPhase(item) === phase,
      )
      .sort(compareMatches)
      .findIndex((item) => item.id === match.id),
  );
}

function getMatchGroupName(match: Match, teams: Team[]) {
  const teamA = teams.find((team) => team.id === match.teamAId);
  const teamB = teams.find((team) => team.id === match.teamBId);
  const groupName = teamA?.groupName || teamB?.groupName;

  return groupName ? `Grupa ${groupName}` : "Grupna faza";
}

function compareMatches(matchA: Match, matchB: Match) {
  return (
    (matchA.scheduledTime || matchA.createdAt).localeCompare(
      matchB.scheduledTime || matchB.createdAt,
    ) ||
    matchA.createdAt.localeCompare(matchB.createdAt) ||
    matchA.id.localeCompare(matchB.id)
  );
}

function statusBadge(status: MatchStatus) {
  const classes: Record<MatchStatus, string> = {
    CANCELLED: "bg-white/10 text-[#CBD5E1]",
    FINISHED: "bg-[#EF4444]/15 text-[#FCA5A5]",
    LIVE: "bg-[#22C55E]/15 text-[#86EFAC]",
    PAUSED: "bg-[#FACC15]/15 text-[#FDE68A]",
    SCHEDULED: "bg-[#38BDF8]/15 text-[#7DD3FC]",
  };

  return classes[status];
}

function matchStatusLabel(status: MatchStatus) {
  const labels: Record<MatchStatus, string> = {
    CANCELLED: "Otkazana",
    FINISHED: "Završena",
    LIVE: "Uživo",
    PAUSED: "Pauza",
    SCHEDULED: "Zakazana",
  };

  return labels[status];
}
