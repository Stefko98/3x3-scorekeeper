"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
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
import { useTournaments } from "../tournaments/tournament-store";
import {
  saveMatchEvents,
  useMatchEvents,
  type MatchEvent,
  type MatchEventType,
} from "./match-event-store";

type LiveScoreClientProps = {
  initialMatchId?: string;
};

type ScoreBySide = {
  teamA: number;
  teamB: number;
};

const pointLimit = 21;
const foulLimit = 6;
const matchLengthSeconds = 10 * 60;

export function LiveScoreClient({ initialMatchId }: LiveScoreClientProps) {
  const matchEvents = useMatchEvents();
  const matches = useMatches();
  const players = usePlayers();
  const teams = useTeams();
  const tournaments = useTournaments();
  const [clockByMatch, setClockByMatch] = useState<Record<string, number>>({});
  const [selectedMatchId, setSelectedMatchId] = useState(initialMatchId ?? "");

  const availableMatches = useMemo(
    () => matches.filter((match) => match.status !== "CANCELLED"),
    [matches],
  );
  const selectedMatch =
    availableMatches.find((match) => match.id === selectedMatchId) ??
    availableMatches.find((match) => match.status === "LIVE") ??
    availableMatches.find((match) => match.status === "PAUSED") ??
    availableMatches.find((match) => match.status === "SCHEDULED") ??
    availableMatches[0];

  const teamA = selectedMatch
    ? teams.find((team) => team.id === selectedMatch.teamAId)
    : undefined;
  const teamB = selectedMatch
    ? teams.find((team) => team.id === selectedMatch.teamBId)
    : undefined;
  const tournament = selectedMatch
    ? tournaments.find((item) => item.id === selectedMatch.tournamentId)
    : undefined;
  const playersA = selectedMatch
    ? players
        .filter((player) => player.teamId === selectedMatch.teamAId)
        .sort((a, b) => a.jerseyNumber - b.jerseyNumber)
    : [];
  const playersB = selectedMatch
    ? players
        .filter((player) => player.teamId === selectedMatch.teamBId)
        .sort((a, b) => a.jerseyNumber - b.jerseyNumber)
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
  const score = selectedMatch
    ? calculateScore(eventsForMatch, selectedMatch)
    : { teamA: 0, teamB: 0 };
  const fouls = selectedMatch
    ? calculateFouls(eventsForMatch, selectedMatch)
    : { teamA: 0, teamB: 0 };
  const playerStats = calculatePlayerStats(eventsForMatch);
  const remainingSeconds = selectedMatch
    ? clockByMatch[selectedMatch.id] ?? matchLengthSeconds
    : matchLengthSeconds;
  const clock = formatClock(remainingSeconds);
  const canEdit =
    selectedMatch?.status === "LIVE" &&
    remainingSeconds > 0 &&
    Boolean(teamA && teamB);
  const isFinished = selectedMatch?.status === "FINISHED";
  const lastEditableEvent = useMemo(
    () =>
      [...eventsForMatch]
        .reverse()
        .find(
          (event) =>
            !event.isDeleted && (event.type === "POINT" || event.type === "FOUL"),
        ),
    [eventsForMatch],
  );

  useEffect(() => {
    if (!selectedMatch || selectedMatch.status !== "LIVE") {
      return;
    }

    const timerId = window.setInterval(() => {
      setClockByMatch((currentClock) => {
        const currentSeconds =
          currentClock[selectedMatch.id] ?? matchLengthSeconds;

        return {
          ...currentClock,
          [selectedMatch.id]: Math.max(0, currentSeconds - 1),
        };
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [selectedMatch]);

  function saveEventsAndMatch(
    nextEventsForMatch: MatchEvent[],
    nextStatus?: MatchStatus,
  ) {
    if (!selectedMatch) {
      return;
    }

    const nextScore = calculateScore(nextEventsForMatch, selectedMatch);
    const nextFouls = calculateFouls(nextEventsForMatch, selectedMatch);
    const now = new Date().toISOString();
    const status = nextStatus ?? selectedMatch.status;

    saveMatchEvents([
      ...matchEvents.filter((event) => event.matchId !== selectedMatch.id),
      ...nextEventsForMatch,
    ]);
    saveMatches(
      matches.map((match) =>
        match.id === selectedMatch.id
          ? {
              ...match,
              finishedAt: status === "FINISHED" ? now : match.finishedAt,
              foulsA: nextFouls.teamA,
              foulsB: nextFouls.teamB,
              scoreA: nextScore.teamA,
              scoreB: nextScore.teamB,
              startedAt:
                status === "LIVE" && !match.startedAt ? now : match.startedAt,
              status,
              updatedAt: now,
              winnerTeamId:
                status === "FINISHED"
                  ? getWinnerTeamId(nextScore, selectedMatch)
                  : match.winnerTeamId,
            }
          : match,
      ),
    );
  }

  function appendControlEvent(
    type: MatchEventType,
    status: MatchStatus,
    description: string,
  ) {
    if (!selectedMatch) {
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
    if (!selectedMatch || selectedMatch.status !== "SCHEDULED") {
      return;
    }

    setClockByMatch((currentClock) => ({
      ...currentClock,
      [selectedMatch.id]: currentClock[selectedMatch.id] ?? matchLengthSeconds,
    }));
    appendControlEvent("START_MATCH", "LIVE", "Utakmica je pokrenuta");
  }

  function pauseMatch() {
    if (!selectedMatch || selectedMatch.status !== "LIVE") {
      return;
    }

    appendControlEvent("PAUSE_MATCH", "PAUSED", "Utakmica je pauzirana");
  }

  function resumeMatch() {
    if (!selectedMatch || selectedMatch.status !== "PAUSED") {
      return;
    }

    appendControlEvent("RESUME_MATCH", "LIVE", "Utakmica je nastavljena");
  }

  function finishMatch(reason?: string) {
    if (
      !selectedMatch ||
      selectedMatch.status === "SCHEDULED" ||
      selectedMatch.status === "FINISHED"
    ) {
      return;
    }

    appendControlEvent(
      "FINISH_MATCH",
      "FINISHED",
      reason
        ? `${reason}. ${getWinnerText(score, selectedMatch, teamMap)}`
        : `Utakmica je zavrsena. ${getWinnerText(score, selectedMatch, teamMap)}`,
    );
  }

  function addPointEvent(player: Player, points: 1 | 2) {
    if (!selectedMatch || !canEdit) {
      return;
    }

    const nextPointEvent = createEvent(selectedMatch, {
      clock,
      playerId: player.id,
      points,
      teamId: player.teamId,
      type: "POINT",
    });
    const nextEvents = [...eventsForMatch, nextPointEvent];
    const nextScore = calculateScore(nextEvents, selectedMatch);
    const teamScore =
      player.teamId === selectedMatch.teamAId
        ? nextScore.teamA
        : nextScore.teamB;

    if (teamScore >= pointLimit) {
      saveEventsAndMatch(
        [
          ...nextEvents,
          createEvent(selectedMatch, {
            clock,
            description: `${getTeamName(player.teamId, teamMap)} je stigao do ${pointLimit} poena.`,
            type: "FINISH_MATCH",
          }),
        ],
        "FINISHED",
      );
      return;
    }

    saveEventsAndMatch(nextEvents);
  }

  function addFoulEvent(player: Player) {
    if (!selectedMatch || !canEdit) {
      return;
    }

    saveEventsAndMatch([
      ...eventsForMatch,
      createEvent(selectedMatch, {
        clock,
        playerId: player.id,
        teamId: player.teamId,
        type: "FOUL",
      }),
    ]);
  }

  function deleteEvent(eventId: string) {
    if (!selectedMatch || isFinished) {
      return;
    }

    const targetEvent = eventsForMatch.find((event) => event.id === eventId);

    if (
      !targetEvent ||
      targetEvent.isDeleted ||
      (targetEvent.type !== "POINT" && targetEvent.type !== "FOUL")
    ) {
      return;
    }

    saveEventsAndMatch([
      ...eventsForMatch.map((event) =>
        event.id === eventId ? { ...event, isDeleted: true } : event,
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
    ]);
  }

  if (availableMatches.length === 0) {
    return (
      <div>
        <LiveHeader title="Live Score" />
        <EmptyState
          actionHref="/matches"
          actionText="Zakazi utakmicu"
          text="Live score radi sa pravim utakmicama. Prvo napravi mec u modulu Utakmice."
          title="Nema utakmica za live score"
        />
      </div>
    );
  }

  if (!selectedMatch || !teamA || !teamB) {
    return (
      <div>
        <LiveHeader title="Live Score" />
        <EmptyState
          actionHref="/matches"
          actionText="Proveri raspored"
          text="Ova utakmica nema kompletne podatke o ekipama."
          title="Nedostaju podaci za utakmicu"
        />
      </div>
    );
  }

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">
            {tournament?.name ?? "Turnir"} / {selectedMatch.courtName}
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">
            Live Score
          </h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_repeat(4,110px)]">
          <select
            className="h-11 rounded-md border border-white/10 bg-[#111827] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#F97316]"
            onChange={(event) => setSelectedMatchId(event.target.value)}
            value={selectedMatch.id}
          >
            {availableMatches.map((match) => (
              <option key={match.id} value={match.id}>
                {getTeamName(match.teamAId, teamMap)} vs{" "}
                {getTeamName(match.teamBId, teamMap)}
              </option>
            ))}
          </select>
          <button
            className="h-11 rounded-md bg-[#22C55E] px-4 text-sm font-black text-[#052E16] transition hover:bg-[#86EFAC] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#94A3B8]"
            disabled={selectedMatch.status !== "SCHEDULED"}
            onClick={startMatch}
            type="button"
          >
            Start
          </button>
          <button
            className="h-11 rounded-md border border-white/15 px-4 text-sm font-black text-white transition hover:border-[#FACC15] hover:text-[#FACC15] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={selectedMatch.status !== "LIVE"}
            onClick={pauseMatch}
            type="button"
          >
            Pause
          </button>
          <button
            className="h-11 rounded-md border border-white/15 px-4 text-sm font-black text-white transition hover:border-[#22C55E] hover:text-[#86EFAC] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={selectedMatch.status !== "PAUSED"}
            onClick={resumeMatch}
            type="button"
          >
            Resume
          </button>
          <button
            className="h-11 rounded-md border border-[#EF4444]/70 px-4 text-sm font-black text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={
              selectedMatch.status === "SCHEDULED" ||
              selectedMatch.status === "FINISHED"
            }
            onClick={() => finishMatch()}
            type="button"
          >
            Finish
          </button>
        </div>
      </header>

      <section className="mt-6 rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)]">
          <TeamScorePanel
            canEdit={canEdit}
            fouls={fouls.teamA}
            onAddFoul={addFoulEvent}
            onAddPoint={addPointEvent}
            playerStats={playerStats}
            players={playersA}
            score={score.teamA}
            sideLabel="Team A"
            team={teamA}
          />

          <Scoreboard
            clock={clock}
            fouls={fouls}
            matchStatus={selectedMatch.status}
            score={score}
          />

          <TeamScorePanel
            canEdit={canEdit}
            fouls={fouls.teamB}
            onAddFoul={addFoulEvent}
            onAddPoint={addPointEvent}
            playerStats={playerStats}
            players={playersB}
            score={score.teamB}
            sideLabel="Team B"
            team={teamB}
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-normal">
                Kontrola zapisnika
              </h3>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Rezultat se racuna iz aktivnih dogadjaja za ovu utakmicu.
              </p>
            </div>
            <button
              className="h-10 rounded-md border border-white/15 px-3 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!lastEditableEvent || isFinished}
              onClick={() => lastEditableEvent && deleteEvent(lastEditableEvent.id)}
              type="button"
            >
              Undo last
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Poen limit" value={pointLimit.toString()} />
            <Metric label="Faul limit" value={foulLimit.toString()} />
            <Metric
              label="Status"
              value={selectedMatch.status}
              valueClassName={statusColor(selectedMatch.status)}
            />
          </div>

          {(playersA.length === 0 || playersB.length === 0) && (
            <p className="mt-4 rounded-md border border-[#FACC15]/30 bg-[#FACC15]/10 px-3 py-2 text-sm font-semibold text-[#FDE68A]">
              Dodaj igrace za obe ekipe da bi dugmad za poene bila korisna.
            </p>
          )}

          {!canEdit && selectedMatch.status !== "LIVE" && (
            <p className="mt-4 rounded-md border border-[#FACC15]/30 bg-[#FACC15]/10 px-3 py-2 text-sm font-semibold text-[#FDE68A]">
              Dugmad za poene i faulove su aktivna samo dok je utakmica LIVE.
            </p>
          )}
        </section>

        <EventLog
          events={eventsForMatch}
          isFinished={Boolean(isFinished)}
          onDeleteEvent={deleteEvent}
          playerMap={playerMap}
          teamMap={teamMap}
        />
      </div>
    </div>
  );
}

function LiveHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-white/10 pb-5">
      <p className="text-sm font-medium text-[#94A3B8]">Live scoring</p>
      <h2 className="mt-1 text-3xl font-bold tracking-normal">{title}</h2>
    </header>
  );
}

function TeamScorePanel({
  canEdit,
  fouls,
  onAddFoul,
  onAddPoint,
  playerStats,
  players,
  score,
  sideLabel,
  team,
}: {
  canEdit: boolean;
  fouls: number;
  onAddFoul: (player: Player) => void;
  onAddPoint: (player: Player, points: 1 | 2) => void;
  playerStats: Record<string, { fouls: number; points: number }>;
  players: Player[];
  score: number;
  sideLabel: "Team A" | "Team B";
  team: Team;
}) {
  const foulWarning = fouls >= foulLimit;
  const sideKey = sideLabel === "Team A" ? "team-a" : "team-b";

  return (
    <article className="rounded-lg border border-white/10 bg-[#0F172A] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black text-[#F97316]">{sideLabel}</p>
          <h3 className="mt-1 text-xl font-bold tracking-normal">
            {team.name}
          </h3>
          <p className="text-sm text-[#94A3B8]">{team.city}</p>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-white/10 text-center">
          <div className="bg-white/[0.04] px-4 py-2">
            <p className="text-xs text-[#94A3B8]">Score</p>
            <p
              className="text-2xl font-black text-white"
              data-testid={`score-${sideKey}`}
            >
              {score}
            </p>
          </div>
          <div className="bg-white/[0.04] px-4 py-2">
            <p className="text-xs text-[#94A3B8]">Fouls</p>
            <p
              className={`text-2xl font-black ${
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
          <p className="text-sm font-bold text-white">Nema igraca</p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Dodaj roster da bi imao dugmad za poene.
          </p>
          <Link
            className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-white/15 px-3 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15]"
            href="/players"
          >
            Igraci
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {players.map((player) => {
            const stats = playerStats[player.id] ?? { fouls: 0, points: 0 };

            return (
              <div
                className="rounded-lg border border-white/10 bg-[#111827] p-3"
                key={player.id}
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      #{player.jerseyNumber} {getPlayerDisplayName(player)}
                    </p>
                    <p className="mt-1 text-xs text-[#94A3B8]">
                      {stats.points} pts / {stats.fouls} fouls
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className="h-12 rounded-md bg-[#F97316] px-3 text-base font-black text-[#111827] transition hover:bg-[#FACC15] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#64748B]"
                      data-testid={`point-${player.id}-1`}
                      disabled={!canEdit}
                      onClick={() => onAddPoint(player, 1)}
                      type="button"
                    >
                      +1
                    </button>
                    <button
                      className="h-12 rounded-md bg-[#F97316] px-3 text-base font-black text-[#111827] transition hover:bg-[#FACC15] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#64748B]"
                      data-testid={`point-${player.id}-2`}
                      disabled={!canEdit}
                      onClick={() => onAddPoint(player, 2)}
                      type="button"
                    >
                      +2
                    </button>
                    <button
                      className="h-12 rounded-md border border-[#FACC15]/60 px-3 text-sm font-black text-[#FACC15] transition hover:bg-[#FACC15] hover:text-[#111827] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-[#64748B]"
                      data-testid={`foul-${player.id}`}
                      disabled={!canEdit}
                      onClick={() => onAddFoul(player)}
                      type="button"
                    >
                      Foul
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

function Scoreboard({
  clock,
  fouls,
  matchStatus,
  score,
}: {
  clock: string;
  fouls: ScoreBySide;
  matchStatus: MatchStatus;
  score: ScoreBySide;
}) {
  return (
    <aside className="flex flex-col justify-center rounded-lg border border-[#F97316]/30 bg-[#0F172A] p-5 text-center">
      <span
        className={`mx-auto rounded-md px-3 py-1 text-xs font-black ${statusBadge(matchStatus)}`}
      >
        {matchStatus}
      </span>

      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
        Clock
      </p>
      <p className="mt-1 text-5xl font-black tracking-normal text-[#FACC15]">
        {clock}
      </p>

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
        Score
      </p>
      <p className="mt-2 text-6xl font-black tracking-normal text-white">
        <span data-testid="main-score-a">{score.teamA}</span>
        <span className="mx-3 text-[#F97316]">:</span>
        <span data-testid="main-score-b">{score.teamB}</span>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Metric label="Fouls A" value={fouls.teamA.toString()} />
        <Metric label="Fouls B" value={fouls.teamB.toString()} />
      </div>
    </aside>
  );
}

function EventLog({
  events,
  isFinished,
  onDeleteEvent,
  playerMap,
  teamMap,
}: {
  events: MatchEvent[];
  isFinished: boolean;
  onDeleteEvent: (eventId: string) => void;
  playerMap: Map<string, Player>;
  teamMap: Map<string, Team>;
}) {
  const orderedEvents = [...events].reverse();

  return (
    <section className="rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold tracking-normal">Event log</h3>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Soft delete cuva trag ispravki.
          </p>
        </div>
        <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-bold text-[#CBD5E1]">
          {events.length}
        </span>
      </div>

      {orderedEvents.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-white/15 bg-[#0F172A] px-3 py-4 text-sm text-[#94A3B8]">
          Zapisnik je prazan dok ne startujes utakmicu ili uneses prvi dogadjaj.
        </p>
      ) : (
        <div
          className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1"
          data-testid="event-log"
        >
          {orderedEvents.map((event) => {
            const canDelete =
              !isFinished &&
              !event.isDeleted &&
              (event.type === "POINT" || event.type === "FOUL");

            return (
              <article
                className={`rounded-md border border-white/10 bg-[#0F172A] p-3 ${
                  event.isDeleted ? "opacity-50" : ""
                }`}
                key={event.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={`text-sm font-semibold text-white ${
                        event.isDeleted ? "line-through" : ""
                      }`}
                    >
                      {getEventText(event, teamMap, playerMap)}
                    </p>
                    <p className="mt-1 text-xs text-[#94A3B8]">
                      Clock {event.clock} / {formatEventTime(event.createdAt)}
                    </p>
                  </div>
                  {canDelete && (
                    <button
                      className="rounded-md border border-white/15 px-2 py-1 text-xs font-bold text-[#CBD5E1] transition hover:border-[#EF4444] hover:text-[#FCA5A5]"
                      onClick={() => onDeleteEvent(event.id)}
                      type="button"
                    >
                      Obrisi
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
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
): Record<string, { fouls: number; points: number }> {
  return events.reduce<Record<string, { fouls: number; points: number }>>(
    (stats, event) => {
      if (!event.playerId || event.isDeleted) {
        return stats;
      }

      stats[event.playerId] ??= { fouls: 0, points: 0 };

      if (event.type === "POINT") {
        stats[event.playerId].points += event.points ?? 0;
      }

      if (event.type === "FOUL") {
        stats[event.playerId].fouls += 1;
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
    "createdAt" | "id" | "isDeleted" | "matchId" | "tournamentId"
  >,
): MatchEvent {
  return {
    ...event,
    createdAt: new Date().toISOString(),
    id: crypto.randomUUID(),
    isDeleted: false,
    matchId: match.id,
    tournamentId: match.tournamentId,
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
    ? getPlayerName(event.playerId, playerMap)
    : "Bez igraca";
  const teamName = event.teamId ? getTeamName(event.teamId, teamMap) : "";

  if (event.type === "POINT") {
    return `${playerName}, ${teamName}, +${event.points}`;
  }

  if (event.type === "FOUL") {
    return `${playerName}, ${teamName}, foul`;
  }

  if (event.type === "DELETE_EVENT") {
    return "Ispravka dogadjaja";
  }

  return event.type;
}

function getPlayerName(playerId: string, playerMap: Map<string, Player>) {
  const player = playerMap.get(playerId);

  if (!player) {
    return "Nepoznat igrac";
  }

  return `#${player.jerseyNumber} ${getPlayerDisplayName(player)}`;
}

function getTeamName(teamId: string, teamMap: Map<string, Team>) {
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
    return "Rezultat je izjednacen.";
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
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
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

function statusColor(status: MatchStatus) {
  const classes: Record<MatchStatus, string> = {
    CANCELLED: "text-[#CBD5E1]",
    FINISHED: "text-[#FCA5A5]",
    LIVE: "text-[#86EFAC]",
    PAUSED: "text-[#FDE68A]",
    SCHEDULED: "text-[#7DD3FC]",
  };

  return classes[status];
}
