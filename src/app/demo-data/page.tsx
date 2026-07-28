"use client";

import { useEffect, useState } from "react";
import type { MatchEvent } from "../live-score/match-event-store";
import type { Match, MatchPhase } from "../matches/match-store";
import type { Player } from "../players/player-store";
import type { Team } from "../teams/team-store";
import type { Tournament } from "../tournaments/tournament-store";

const demoPrefix = "demo-3x3-view-";

const storageKeys = {
  events: "3x3-tournament-manager:match-events",
  matches: "3x3-tournament-manager:matches",
  players: "3x3-tournament-manager:players",
  teams: "3x3-tournament-manager:teams",
  tournaments: "3x3-tournament-manager:tournaments",
};

const storeEvents = [
  "3x3-tournaments-updated",
  "3x3-teams-updated",
  "3x3-players-updated",
  "3x3-matches-updated",
  "3x3-match-events-updated",
];

type DemoSummary = {
  events: number;
  matches: number;
  players: number;
  teams: number;
  tournamentName: string;
};

type TeamSeed = {
  city: string;
  groupName: string;
  name: string;
  slug: string;
};

type MatchSeed = {
  phase: MatchPhase;
  scoreA: number;
  scoreB: number;
  slug: string;
  startsInMinutes: number;
  teamA: string;
  teamB: string;
};

export default function DemoDataPage() {
  const [message, setMessage] = useState("Pripremam demo podatke...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode") ?? "seed";
    let nextMessage = "";

    if (mode === "clear") {
      clearDemoData();
      nextMessage = "Demo podaci su obrisani.";
    } else if (mode === "pending-knockout") {
      const summary = resetDemoKnockout();
      nextMessage = `Knockout u demo turniru je vracen na neodigrano: ${summary.matches} utakmice čekaju igru.`;
    } else {
      const summary = seedDemoData();
      nextMessage = `Ubacen je ${summary.tournamentName}: ${summary.teams} ekipa, ${summary.players} igrača, ${summary.matches} utakmica i ${summary.events} događaja.`;
    }

    window.setTimeout(() => setMessage(nextMessage), 0);
    window.setTimeout(() => {
      window.location.assign("/tournaments");
    }, 900);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0F172A] p-6 text-white">
      <section className="max-w-xl rounded-lg border border-white/10 bg-[#111827] p-6 text-center shadow-[0_18px_40px_rgba(2,6,23,0.28)]">
        <p className="text-sm font-black uppercase text-[#FACC15]">
          Demo podaci
        </p>
        <h1 className="mt-2 text-2xl font-black">Priprema turnira</h1>
        <p className="mt-3 text-sm font-semibold text-[#CBD5E1]">{message}</p>
      </section>
    </main>
  );
}

function seedDemoData(): DemoSummary {
  const tournamentId = `${demoPrefix}tournament`;
  const now = new Date();
  const isoAt = (minutesFromNow: number) =>
    new Date(now.getTime() + minutesFromNow * 60_000).toISOString();

  const tournament: Tournament = {
    city: "Beograd",
    country: "Srbija",
    createdAt: isoAt(-240),
    description:
      "Demo turnir za pregled aplikacije: 2 grupe, 8 ekipa, igrači, rezultati i kompletno knockout stablo.",
    endDate: "2026-07-07",
    groupCount: 2,
    id: tournamentId,
    location: "Demo lokacija",
    maxTeams: 8,
    name: "DEMO 3x3 Kup - 8 ekipa",
    knockoutTeams: 4,
    numberOfCourts: 2,
    publicSlug: "demo-3x3-kup-8-ekipa",
    registrationOpen: false,
    startDate: "2026-07-07",
    status: "FINISHED",
    tournamentType: "GROUPS_AND_KNOCKOUT",
    updatedAt: isoAt(0),
  };
  const teams = createTeams(tournamentId, isoAt);
  const players = createPlayers(tournamentId, teams, isoAt);
  const { events, matches } = createMatchesAndEvents({
    isoAt,
    players,
    teams,
    tournamentId,
  });

  const current = readAllStores();
  const next = {
    events: [...events, ...cleanDemoItems(current.events)],
    matches: [...matches, ...cleanDemoItems(current.matches)],
    players: [...players, ...cleanDemoItems(current.players)],
    teams: [...teams, ...cleanDemoItems(current.teams)],
    tournaments: [tournament, ...cleanDemoItems(current.tournaments)],
  };

  writeStore(storageKeys.tournaments, next.tournaments);
  writeStore(storageKeys.teams, next.teams);
  writeStore(storageKeys.players, next.players);
  writeStore(storageKeys.matches, next.matches);
  writeStore(storageKeys.events, next.events);
  notifyStores();

  return {
    events: events.length,
    matches: matches.length,
    players: players.length,
    teams: teams.length,
    tournamentName: tournament.name,
  };
}

function clearDemoData() {
  const current = readAllStores();

  writeStore(storageKeys.tournaments, cleanDemoItems(current.tournaments));
  writeStore(storageKeys.teams, cleanDemoItems(current.teams));
  writeStore(storageKeys.players, cleanDemoItems(current.players));
  writeStore(storageKeys.matches, cleanDemoItems(current.matches));
  writeStore(storageKeys.events, cleanDemoItems(current.events));
  notifyStores();
}

function resetDemoKnockout() {
  const seededSummary = seedDemoData();
  const current = readAllStores();
  const knockoutMatchIds = new Set(
    current.matches
      .filter(
        (match) =>
          match.tournamentId === `${demoPrefix}tournament` &&
          match.matchPhase !== "GROUP_STAGE",
      )
      .map((match) => match.id),
  );
  const now = new Date().toISOString();
  const matches = current.matches.map((match) => {
    if (!knockoutMatchIds.has(match.id)) {
      return match;
    }

    const isFinal = match.matchPhase === "FINAL";
    const cleanMatch: Match = {
      ...match,
      finishedAt: undefined,
      foulsA: 0,
      foulsB: 0,
      scoreA: 0,
      scoreB: 0,
      startedAt: undefined,
      status: "SCHEDULED",
      teamAId: isFinal ? "" : match.teamAId,
      teamBId: isFinal ? "" : match.teamBId,
      updatedAt: now,
      winnerTeamId: undefined,
    };

    return cleanMatch;
  });
  const events = current.events.filter(
    (event) => !knockoutMatchIds.has(event.matchId),
  );

  writeStore(storageKeys.matches, matches);
  writeStore(storageKeys.events, events);
  notifyStores();

  return {
    ...seededSummary,
    matches: knockoutMatchIds.size,
  };
}

function createTeams(
  tournamentId: string,
  isoAt: (minutesFromNow: number) => string,
): Team[] {
  const seeds: TeamSeed[] = [
    { city: "Beograd", groupName: "A", name: "Kalemegdan Kings", slug: "kalemegdan" },
    { city: "Beograd", groupName: "A", name: "Avala Wolves", slug: "avala" },
    { city: "Beograd", groupName: "A", name: "Dorcol 21", slug: "dorcol" },
    { city: "Zemun", groupName: "A", name: "Zemun Street", slug: "zemun" },
    { city: "Novi Beograd", groupName: "B", name: "Novi Beograd", slug: "novi" },
    { city: "Beograd", groupName: "B", name: "Sava Crew", slug: "sava" },
    { city: "Beograd", groupName: "B", name: "Skadarlija Hoops", slug: "skadarlija" },
    { city: "Vozdovac", groupName: "B", name: "Vozdovac 3x3", slug: "vozdovac" },
  ];

  return seeds.map((seed, index) => ({
    captainPhone: `060/100-10${index}`,
    city: seed.city,
    createdAt: isoAt(-230 + index),
    groupName: seed.groupName,
    id: `${demoPrefix}team-${seed.slug}`,
    logoUrl: "",
    name: seed.name,
    status: "CONFIRMED",
    tournamentId,
    updatedAt: isoAt(-20),
  }));
}

function createPlayers(
  tournamentId: string,
  teams: Team[],
  isoAt: (minutesFromNow: number) => string,
): Player[] {
  const names = [
    [["Luka", "Petrovic"], ["Marko", "Ilic"], ["Nikola", "Savic"], ["Vuk", "Jovanovic"]],
    [["Stefan", "Pavlovic"], ["Milos", "Stankovic"], ["Filip", "Radic"], ["Dusan", "Lazic"]],
    [["Nemanja", "Kostić"], ["Aleksa", "Matić"], ["Ognjen", "Đorđević"], ["Uroš", "Milovanovic"]],
    [["Bogdan", "Nikolic"], ["Vasilije", "Jankovic"], ["Andrej", "Simic"], ["Mihajlo", "Tadic"]],
    [["Petar", "Popovic"], ["Viktor", "Ristic"], ["Lazar", "Vasic"], ["Relja", "Tomic"]],
    [["Milan", "Maric"], ["Strahinja", "Djukic"], ["Pavle", "Bojic"], ["Srdjan", "Mirkovic"]],
    [["Ivan", "Stević"], ["Matija", "Nedić"], ["Danilo", "Živković"], ["Kosta", "Perić"]],
    [["Dimitrije", "Tosic"], ["Veljko", "Lukic"], ["Sergej", "Mitrovic"], ["Teodor", "Grujic"]],
  ];
  const jerseyNumbers = [3, 7, 11, 21];

  return teams.flatMap((team, teamIndex) =>
    names[teamIndex].map(([firstName, lastName], playerIndex) => ({
      createdAt: isoAt(-220 + teamIndex * 4 + playerIndex),
      firstName,
      id: `${demoPrefix}player-${team.id.replace(`${demoPrefix}team-`, "")}-${playerIndex + 1}`,
      jerseyNumber: jerseyNumbers[playerIndex],
      lastName,
      photoUrl: "",
      teamId: team.id,
      tournamentId,
      updatedAt: isoAt(-10),
    })),
  );
}

function createMatchesAndEvents({
  isoAt,
  players,
  teams,
  tournamentId,
}: {
  isoAt: (minutesFromNow: number) => string;
  players: Player[];
  teams: Team[];
  tournamentId: string;
}) {
  const teamBySlug = Object.fromEntries(
    teams.map((team) => [team.id.replace(`${demoPrefix}team-`, ""), team]),
  );
  const matchSeeds: MatchSeed[] = [
    { phase: "GROUP_STAGE", scoreA: 18, scoreB: 16, slug: "g-a-1", startsInMinutes: -180, teamA: "kalemegdan", teamB: "zemun" },
    { phase: "GROUP_STAGE", scoreA: 21, scoreB: 15, slug: "g-a-2", startsInMinutes: -174, teamA: "avala", teamB: "dorcol" },
    { phase: "GROUP_STAGE", scoreA: 21, scoreB: 14, slug: "g-a-3", startsInMinutes: -168, teamA: "kalemegdan", teamB: "dorcol" },
    { phase: "GROUP_STAGE", scoreA: 19, scoreB: 17, slug: "g-a-4", startsInMinutes: -162, teamA: "avala", teamB: "zemun" },
    { phase: "GROUP_STAGE", scoreA: 21, scoreB: 17, slug: "g-a-5", startsInMinutes: -156, teamA: "kalemegdan", teamB: "avala" },
    { phase: "GROUP_STAGE", scoreA: 22, scoreB: 20, slug: "g-a-6", startsInMinutes: -150, teamA: "dorcol", teamB: "zemun" },
    { phase: "GROUP_STAGE", scoreA: 21, scoreB: 13, slug: "g-b-1", startsInMinutes: -144, teamA: "novi", teamB: "vozdovac" },
    { phase: "GROUP_STAGE", scoreA: 18, scoreB: 20, slug: "g-b-2", startsInMinutes: -138, teamA: "sava", teamB: "skadarlija" },
    { phase: "GROUP_STAGE", scoreA: 16, scoreB: 18, slug: "g-b-3", startsInMinutes: -132, teamA: "novi", teamB: "sava" },
    { phase: "GROUP_STAGE", scoreA: 21, scoreB: 15, slug: "g-b-4", startsInMinutes: -126, teamA: "skadarlija", teamB: "vozdovac" },
    { phase: "GROUP_STAGE", scoreA: 22, scoreB: 20, slug: "g-b-5", startsInMinutes: -120, teamA: "novi", teamB: "skadarlija" },
    { phase: "GROUP_STAGE", scoreA: 21, scoreB: 12, slug: "g-b-6", startsInMinutes: -114, teamA: "sava", teamB: "vozdovac" },
    { phase: "SEMI_FINAL", scoreA: 21, scoreB: 18, slug: "sf-1", startsInMinutes: -60, teamA: "kalemegdan", teamB: "sava" },
    { phase: "SEMI_FINAL", scoreA: 17, scoreB: 21, slug: "sf-2", startsInMinutes: -50, teamA: "novi", teamB: "avala" },
    { phase: "FINAL", scoreA: 19, scoreB: 21, slug: "final", startsInMinutes: -30, teamA: "kalemegdan", teamB: "avala" },
  ];
  const matches: Match[] = matchSeeds.map((seed, index) => {
    const teamA = teamBySlug[seed.teamA];
    const teamB = teamBySlug[seed.teamB];

    return {
      courtName: "Kos 1",
      createdAt: isoAt(seed.startsInMinutes - 1),
      finishedAt: isoAt(seed.startsInMinutes + 10),
      foulsA: 2 + (index % 2),
      foulsB: 2 + ((index + 1) % 2),
      id: `${demoPrefix}match-${seed.slug}`,
      matchPhase: seed.phase,
      scheduledTime: isoAt(seed.startsInMinutes),
      scoreA: seed.scoreA,
      scoreB: seed.scoreB,
      startedAt: isoAt(seed.startsInMinutes),
      status: "FINISHED",
      teamAId: teamA.id,
      teamBId: teamB.id,
      tournamentId,
      updatedAt: isoAt(seed.startsInMinutes + 10),
      winnerTeamId: seed.scoreA > seed.scoreB ? teamA.id : teamB.id,
    };
  });
  const events = createMatchEvents(matches, players, tournamentId);

  return { events, matches };
}

function createMatchEvents(
  matches: Match[],
  players: Player[],
  tournamentId: string,
): MatchEvent[] {
  const playersByTeam = new Map(
    [...new Set(players.map((player) => player.teamId))].map((teamId) => [
      teamId,
      players.filter((player) => player.teamId === teamId),
    ]),
  );
  let globalCounter = 0;

  return matches.flatMap((match) => {
    const teamAPlayers = playersByTeam.get(match.teamAId) ?? [];
    const teamBPlayers = playersByTeam.get(match.teamBId) ?? [];
    const aPoints = pointChunks(match.scoreA);
    const bPoints = pointChunks(match.scoreB);
    const matchEvents: MatchEvent[] = [
      {
        clock: "10:00",
        createdAt: withOffset(match.startedAt, globalCounter++),
        description: "Utakmica je pokrenuta",
        id: `${demoPrefix}event-${match.id}-start`,
        isDeleted: false,
        matchId: match.id,
        tournamentId,
        type: "START_MATCH",
      },
    ];
    let scoreA = 0;
    let scoreB = 0;
    let step = 0;
    let teamAPlayerIndex = 0;
    let teamBPlayerIndex = 0;

    while (aPoints.length > 0 || bPoints.length > 0) {
      const useTeamA = Boolean(
        aPoints.length > 0 &&
          (bPoints.length === 0 || scoreA / match.scoreA <= scoreB / match.scoreB),
      );
      const points = (useTeamA ? aPoints.shift() : bPoints.shift()) ?? 1;
      const playerList = useTeamA ? teamAPlayers : teamBPlayers;
      const player =
        playerList[
          (useTeamA ? teamAPlayerIndex++ : teamBPlayerIndex++) % playerList.length
        ];

      if (useTeamA) {
        scoreA += points;
      } else {
        scoreB += points;
      }

      step += 1;
      matchEvents.push({
        clock: formatClock(600 - step * 18),
        createdAt: withOffset(match.startedAt, globalCounter++),
        id: `${demoPrefix}event-${match.id}-${step}`,
        isDeleted: false,
        matchId: match.id,
        playerId: player.id,
        points: points as 1 | 2,
        scoreA,
        scoreB,
        teamId: useTeamA ? match.teamAId : match.teamBId,
        tournamentId,
        type: "POINT",
      });

      if (step === 6 || step === 13 || step === 20) {
        const foulTeamId = step === 13 ? match.teamBId : match.teamAId;
        const foulPlayers = playersByTeam.get(foulTeamId) ?? [];
        const foulPlayer = foulPlayers[step % foulPlayers.length];

        matchEvents.push({
          clock: formatClock(600 - step * 18 - 6),
          createdAt: withOffset(match.startedAt, globalCounter++),
          id: `${demoPrefix}event-${match.id}-foul-${step}`,
          isDeleted: false,
          matchId: match.id,
          playerId: foulPlayer.id,
          teamId: foulTeamId,
          tournamentId,
          type: "FOUL",
        });
      }
    }

    matchEvents.push({
      clock: "00:00",
      createdAt: withOffset(match.finishedAt ?? match.updatedAt, globalCounter++),
      description: "Utakmica je završena.",
      id: `${demoPrefix}event-${match.id}-finish`,
      isDeleted: false,
      matchId: match.id,
      tournamentId,
      type: "FINISH_MATCH",
    });

    return matchEvents;
  });
}

function pointChunks(total: number) {
  const chunks: Array<1 | 2> = [];
  let remaining = total;

  while (remaining > 0) {
    const next = remaining === 1 ? 1 : chunks.length % 4 === 3 ? 1 : 2;
    const value = Math.min(next, remaining) as 1 | 2;
    chunks.push(value);
    remaining -= value;
  }

  return chunks;
}

function formatClock(seconds: number) {
  const value = Math.max(0, seconds);
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const secondsLeft = (value % 60).toString().padStart(2, "0");

  return `${minutes}:${secondsLeft}`;
}

function withOffset(value: string | undefined, offsetSeconds: number) {
  return new Date(new Date(value ?? new Date().toISOString()).getTime() + offsetSeconds * 1000).toISOString();
}

function readAllStores() {
  return {
    events: readStore<MatchEvent>(storageKeys.events),
    matches: readStore<Match>(storageKeys.matches),
    players: readStore<Player>(storageKeys.players),
    teams: readStore<Team>(storageKeys.teams),
    tournaments: readStore<Tournament>(storageKeys.tournaments),
  };
}

function readStore<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore<T>(key: string, items: T[]) {
  window.localStorage.setItem(key, JSON.stringify(items));
}

function cleanDemoItems<T extends { id?: string; matchId?: string; teamId?: string; tournamentId?: string }>(
  items: T[],
) {
  return items.filter((item) => {
    const id = item.id ?? "";
    const matchId = item.matchId ?? "";
    const teamId = item.teamId ?? "";
    const tournamentId = item.tournamentId ?? "";

    return (
      !id.startsWith(demoPrefix) &&
      !matchId.startsWith(demoPrefix) &&
      !teamId.startsWith(demoPrefix) &&
      !tournamentId.startsWith(demoPrefix)
    );
  });
}

function notifyStores() {
  for (const storeEvent of storeEvents) {
    window.dispatchEvent(new Event(storeEvent));
  }
}
