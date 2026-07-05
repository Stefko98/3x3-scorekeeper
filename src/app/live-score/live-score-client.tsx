"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type TeamId = "team-a" | "team-b";
type MatchStatus = "SCHEDULED" | "LIVE" | "PAUSED" | "FINISHED";
type MatchEventType =
  | "POINT"
  | "FOUL"
  | "START_MATCH"
  | "PAUSE_MATCH"
  | "RESUME_MATCH"
  | "FINISH_MATCH"
  | "DELETE_EVENT";

type Player = {
  id: string;
  teamId: TeamId;
  number: number;
  name: string;
};

type Team = {
  id: TeamId;
  name: string;
  city: string;
  players: Player[];
};

type MatchEvent = {
  id: string;
  type: MatchEventType;
  teamId?: TeamId;
  playerId?: string;
  points?: 1 | 2;
  clock: string;
  createdAt: string;
  description?: string;
  isDeleted: boolean;
  deletedEventId?: string;
};

const teams: Team[] = [
  {
    id: "team-a",
    name: "Belgrade Wolves",
    city: "Belgrade",
    players: [
      { id: "a-7", teamId: "team-a", number: 7, name: "Marko Markovic" },
      { id: "a-11", teamId: "team-a", number: 11, name: "Nikola Petrovic" },
      { id: "a-23", teamId: "team-a", number: 23, name: "Stefan Jovanovic" },
      { id: "a-32", teamId: "team-a", number: 32, name: "Milos Djuric" },
    ],
  },
  {
    id: "team-b",
    name: "Novi Sad Tigers",
    city: "Novi Sad",
    players: [
      { id: "b-3", teamId: "team-b", number: 3, name: "Luka Ilic" },
      { id: "b-9", teamId: "team-b", number: 9, name: "Petar Simic" },
      { id: "b-15", teamId: "team-b", number: 15, name: "Ivan Kostic" },
      { id: "b-21", teamId: "team-b", number: 21, name: "Vuk Ristic" },
    ],
  },
];

const playerMap = new Map(
  teams.flatMap((team) => team.players.map((player) => [player.id, player])),
);

const teamMap = new Map(teams.map((team) => [team.id, team]));

const initialEvents: MatchEvent[] = [
  {
    id: "seed-start",
    type: "START_MATCH",
    clock: "10:00",
    createdAt: "14:00:00",
    description: "Utakmica je pokrenuta",
    isDeleted: false,
  },
  {
    id: "seed-a-1",
    type: "POINT",
    teamId: "team-a",
    playerId: "a-7",
    points: 2,
    clock: "09:22",
    createdAt: "14:00:38",
    isDeleted: false,
  },
  {
    id: "seed-b-1",
    type: "POINT",
    teamId: "team-b",
    playerId: "b-3",
    points: 1,
    clock: "08:54",
    createdAt: "14:01:06",
    isDeleted: false,
  },
  {
    id: "seed-a-2",
    type: "FOUL",
    teamId: "team-a",
    playerId: "a-11",
    clock: "08:10",
    createdAt: "14:01:50",
    isDeleted: false,
  },
  {
    id: "seed-b-2",
    type: "POINT",
    teamId: "team-b",
    playerId: "b-9",
    points: 2,
    clock: "07:44",
    createdAt: "14:02:16",
    isDeleted: false,
  },
  {
    id: "seed-a-3",
    type: "POINT",
    teamId: "team-a",
    playerId: "a-23",
    points: 1,
    clock: "07:12",
    createdAt: "14:02:48",
    isDeleted: false,
  },
];

const initialSeconds = 6 * 60 + 42;
const pointLimit = 21;
const foulLimit = 6;

export function LiveScoreClient() {
  const [events, setEvents] = useState<MatchEvent[]>(initialEvents);
  const [matchStatus, setMatchStatus] = useState<MatchStatus>("LIVE");
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);

  const score = useMemo(() => calculateScore(events), [events]);
  const fouls = useMemo(() => calculateFouls(events), [events]);
  const playerStats = useMemo(() => calculatePlayerStats(events), [events]);
  const clock = formatClock(remainingSeconds);
  const canEdit = matchStatus === "LIVE" && remainingSeconds > 0;
  const isFinished = matchStatus === "FINISHED";

  const lastEditableEvent = useMemo(
    () =>
      [...events]
        .reverse()
        .find(
          (event) =>
            !event.isDeleted && (event.type === "POINT" || event.type === "FOUL"),
        ),
    [events],
  );

  const finishMatch = useCallback(
    (reason?: string) => {
      if (matchStatus === "FINISHED" || matchStatus === "SCHEDULED") {
        return;
      }

      const winnerText = getWinnerText(score);
      setMatchStatus("FINISHED");
      setEvents((currentEvents) => [
        ...currentEvents,
        createEvent({
          type: "FINISH_MATCH",
          clock,
          description: reason
            ? `${reason}. ${winnerText}`
            : `Utakmica je zavrsena. ${winnerText}`,
        }),
      ]);
    },
    [clock, matchStatus, score],
  );

  useEffect(() => {
    if (matchStatus !== "LIVE" || remainingSeconds <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [matchStatus, remainingSeconds]);

  function addPointEvent(playerId: string, points: 1 | 2) {
    if (!canEdit) {
      return;
    }

    const player = playerMap.get(playerId);
    if (!player) {
      return;
    }

    const nextPointEvent = createEvent({
      type: "POINT",
      teamId: player.teamId,
      playerId: player.id,
      points,
      clock,
    });

    setEvents((currentEvents) => {
      const nextEvents = [...currentEvents, nextPointEvent];
      const nextScore = calculateScore(nextEvents);
      const teamScore = nextScore[player.teamId];

      if (teamScore >= pointLimit) {
        setMatchStatus("FINISHED");
        return [
          ...nextEvents,
          createEvent({
            type: "FINISH_MATCH",
            clock,
            description: `${getTeamName(player.teamId)} je stigao do ${pointLimit} poena.`,
          }),
        ];
      }

      return nextEvents;
    });
  }

  function addFoulEvent(playerId: string) {
    if (!canEdit) {
      return;
    }

    const player = playerMap.get(playerId);
    if (!player) {
      return;
    }

    setEvents((currentEvents) => [
      ...currentEvents,
      createEvent({
        type: "FOUL",
        teamId: player.teamId,
        playerId: player.id,
        clock,
      }),
    ]);
  }

  function deleteEvent(eventId: string) {
    if (isFinished) {
      return;
    }

    const targetEvent = events.find((event) => event.id === eventId);
    if (
      !targetEvent ||
      targetEvent.isDeleted ||
      (targetEvent.type !== "POINT" && targetEvent.type !== "FOUL")
    ) {
      return;
    }

    setEvents((currentEvents) => [
      ...currentEvents.map((event) =>
        event.id === eventId ? { ...event, isDeleted: true } : event,
      ),
      createEvent({
        type: "DELETE_EVENT",
        clock,
        deletedEventId: eventId,
        description: `Ispravljen unos: ${getEventText(targetEvent)}`,
      }),
    ]);
  }

  function startMatch() {
    if (matchStatus !== "SCHEDULED") {
      return;
    }

    setMatchStatus("LIVE");
    setEvents((currentEvents) => [
      ...currentEvents,
      createEvent({
        type: "START_MATCH",
        clock,
        description: "Utakmica je pokrenuta",
      }),
    ]);
  }

  function pauseMatch() {
    if (matchStatus !== "LIVE") {
      return;
    }

    setMatchStatus("PAUSED");
    setEvents((currentEvents) => [
      ...currentEvents,
      createEvent({
        type: "PAUSE_MATCH",
        clock,
        description: "Utakmica je pauzirana",
      }),
    ]);
  }

  function resumeMatch() {
    if (matchStatus !== "PAUSED") {
      return;
    }

    setMatchStatus("LIVE");
    setEvents((currentEvents) => [
      ...currentEvents,
      createEvent({
        type: "RESUME_MATCH",
        clock,
        description: "Utakmica je nastavljena",
      }),
    ]);
  }

  function resetMatch() {
    setEvents(initialEvents);
    setMatchStatus("LIVE");
    setRemainingSeconds(initialSeconds);
  }

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#94A3B8]">
            Downtown 3x3 Classic / Court 1
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal">
            Live Score
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <button
            className="h-11 rounded-md bg-[#22C55E] px-4 text-sm font-black text-[#052E16] transition hover:bg-[#86EFAC] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#94A3B8]"
            disabled={matchStatus !== "SCHEDULED"}
            onClick={startMatch}
            type="button"
          >
            Start
          </button>
          <button
            className="h-11 rounded-md border border-white/15 px-4 text-sm font-black text-white transition hover:border-[#FACC15] hover:text-[#FACC15] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={matchStatus !== "LIVE"}
            onClick={pauseMatch}
            type="button"
          >
            Pause
          </button>
          <button
            className="h-11 rounded-md border border-white/15 px-4 text-sm font-black text-white transition hover:border-[#22C55E] hover:text-[#86EFAC] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={matchStatus !== "PAUSED"}
            onClick={resumeMatch}
            type="button"
          >
            Resume
          </button>
          <button
            className="h-11 rounded-md border border-[#EF4444]/70 px-4 text-sm font-black text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={matchStatus === "SCHEDULED" || matchStatus === "FINISHED"}
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
            fouls={fouls["team-a"]}
            onAddFoul={addFoulEvent}
            onAddPoint={addPointEvent}
            playerStats={playerStats}
            score={score["team-a"]}
            team={teams[0]}
          />

          <Scoreboard
            clock={clock}
            fouls={fouls}
            matchStatus={matchStatus}
            score={score}
          />

          <TeamScorePanel
            canEdit={canEdit}
            fouls={fouls["team-b"]}
            onAddFoul={addFoulEvent}
            onAddPoint={addPointEvent}
            playerStats={playerStats}
            score={score["team-b"]}
            team={teams[1]}
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
                Rezultat se racuna iz svih aktivnih dogadjaja.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="h-10 rounded-md border border-white/15 px-3 text-sm font-bold text-white transition hover:border-[#F97316] hover:text-[#FACC15] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!lastEditableEvent || isFinished}
                onClick={() => lastEditableEvent && deleteEvent(lastEditableEvent.id)}
                type="button"
              >
                Undo last
              </button>
              <button
                className="h-10 rounded-md border border-white/15 px-3 text-sm font-bold text-[#CBD5E1] transition hover:border-[#94A3B8] hover:text-white"
                onClick={resetMatch}
                type="button"
              >
                Reset demo
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Poen limit" value={pointLimit.toString()} />
            <Metric label="Faul limit" value={foulLimit.toString()} />
            <Metric
              label="Status"
              value={matchStatus}
              valueClassName={statusColor(matchStatus)}
            />
          </div>

          {!canEdit && (
            <p className="mt-4 rounded-md border border-[#FACC15]/30 bg-[#FACC15]/10 px-3 py-2 text-sm font-semibold text-[#FDE68A]">
              Dugmad za poene i faulove su aktivna samo dok je utakmica LIVE.
            </p>
          )}
        </section>

        <EventLog
          events={events}
          isFinished={isFinished}
          onDeleteEvent={deleteEvent}
        />
      </div>
    </div>
  );
}

function TeamScorePanel({
  canEdit,
  fouls,
  onAddFoul,
  onAddPoint,
  playerStats,
  score,
  team,
}: {
  canEdit: boolean;
  fouls: number;
  onAddFoul: (playerId: string) => void;
  onAddPoint: (playerId: string, points: 1 | 2) => void;
  playerStats: Record<string, { fouls: number; points: number }>;
  score: number;
  team: Team;
}) {
  const foulWarning = fouls >= foulLimit;

  return (
    <article className="rounded-lg border border-white/10 bg-[#0F172A] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black text-[#F97316]">
            {team.id === "team-a" ? "Team A" : "Team B"}
          </p>
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
              data-testid={`score-${team.id}`}
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
              data-testid={`fouls-${team.id}`}
            >
              {fouls}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {team.players.map((player) => {
          const stats = playerStats[player.id] ?? { fouls: 0, points: 0 };

          return (
            <div
              className="rounded-lg border border-white/10 bg-[#111827] p-3"
              key={player.id}
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    #{player.number} {player.name}
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
                    onClick={() => onAddPoint(player.id, 1)}
                    type="button"
                  >
                    +1
                  </button>
                  <button
                    className="h-12 rounded-md bg-[#F97316] px-3 text-base font-black text-[#111827] transition hover:bg-[#FACC15] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#64748B]"
                    data-testid={`point-${player.id}-2`}
                    disabled={!canEdit}
                    onClick={() => onAddPoint(player.id, 2)}
                    type="button"
                  >
                    +2
                  </button>
                  <button
                    className="h-12 rounded-md border border-[#FACC15]/60 px-3 text-sm font-black text-[#FACC15] transition hover:bg-[#FACC15] hover:text-[#111827] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-[#64748B]"
                    data-testid={`foul-${player.id}`}
                    disabled={!canEdit}
                    onClick={() => onAddFoul(player.id)}
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
  fouls: Record<TeamId, number>;
  matchStatus: MatchStatus;
  score: Record<TeamId, number>;
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
        <span data-testid="main-score-a">{score["team-a"]}</span>
        <span className="mx-3 text-[#F97316]">:</span>
        <span data-testid="main-score-b">{score["team-b"]}</span>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Metric label="Fouls A" value={fouls["team-a"].toString()} />
        <Metric label="Fouls B" value={fouls["team-b"].toString()} />
      </div>
    </aside>
  );
}

function EventLog({
  events,
  isFinished,
  onDeleteEvent,
}: {
  events: MatchEvent[];
  isFinished: boolean;
  onDeleteEvent: (eventId: string) => void;
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

      <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1" data-testid="event-log">
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
                    {getEventText(event)}
                  </p>
                  <p className="mt-1 text-xs text-[#94A3B8]">
                    Clock {event.clock} / {event.createdAt}
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
      <p className={`mt-1 text-xl font-black ${valueClassName}`}>{value}</p>
    </div>
  );
}

function calculateScore(events: MatchEvent[]): Record<TeamId, number> {
  return events.reduce(
    (score, event) => {
      if (event.type === "POINT" && event.teamId && !event.isDeleted) {
        score[event.teamId] += event.points ?? 0;
      }

      return score;
    },
    { "team-a": 0, "team-b": 0 },
  );
}

function calculateFouls(events: MatchEvent[]): Record<TeamId, number> {
  return events.reduce(
    (fouls, event) => {
      if (event.type === "FOUL" && event.teamId && !event.isDeleted) {
        fouls[event.teamId] += 1;
      }

      return fouls;
    },
    { "team-a": 0, "team-b": 0 },
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

function createEvent(event: Omit<MatchEvent, "createdAt" | "id" | "isDeleted">): MatchEvent {
  return {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toLocaleTimeString("sr-RS", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    isDeleted: false,
  };
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secondsLeft = (seconds % 60).toString().padStart(2, "0");

  return `${minutes}:${secondsLeft}`;
}

function getEventText(event: MatchEvent) {
  if (event.description) {
    return event.description;
  }

  const playerName = event.playerId
    ? playerMap.get(event.playerId)?.name ?? "Nepoznat igrac"
    : "Bez igraca";
  const teamName = event.teamId ? getTeamName(event.teamId) : "";

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

function getTeamName(teamId: TeamId) {
  return teamMap.get(teamId)?.name ?? "Nepoznat tim";
}

function getWinnerText(score: Record<TeamId, number>) {
  if (score["team-a"] === score["team-b"]) {
    return "Rezultat je izjednacen.";
  }

  const winnerId = score["team-a"] > score["team-b"] ? "team-a" : "team-b";
  return `Pobednik: ${getTeamName(winnerId)}.`;
}

function statusBadge(status: MatchStatus) {
  const classes: Record<MatchStatus, string> = {
    SCHEDULED: "bg-[#38BDF8]/15 text-[#7DD3FC]",
    LIVE: "bg-[#22C55E]/15 text-[#86EFAC]",
    PAUSED: "bg-[#FACC15]/15 text-[#FDE68A]",
    FINISHED: "bg-[#EF4444]/15 text-[#FCA5A5]",
  };

  return classes[status];
}

function statusColor(status: MatchStatus) {
  const classes: Record<MatchStatus, string> = {
    SCHEDULED: "text-[#7DD3FC]",
    LIVE: "text-[#86EFAC]",
    PAUSED: "text-[#FDE68A]",
    FINISHED: "text-[#FCA5A5]",
  };

  return classes[status];
}
