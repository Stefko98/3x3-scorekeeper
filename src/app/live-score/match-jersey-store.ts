"use client";

import { createLocalStorageStore } from "../lib/create-local-storage-store";
import type { Match } from "../matches/match-store";

export type MatchJersey = {
  id: string;
  jerseyNumber: number;
  matchId: string;
  playerId: string;
  updatedAt: string;
};

const matchJerseyStore = createLocalStorageStore<MatchJersey>({
  eventName: "3x3-match-jerseys-updated",
  isItem: isMatchJersey,
  storageKey: "3x3-tournament-manager:match-jerseys",
});

export const useMatchJerseys = matchJerseyStore.useItems;
export const saveMatchJerseys = matchJerseyStore.saveItems;

export function getMatchJerseyId(matchId: string, playerId: string) {
  return `match-jersey:${matchId}:${playerId}`;
}

export function getVisualMatchJerseyMap(
  matchJerseys: MatchJersey[],
  matches: Match[],
  selectedMatch: Match | undefined,
) {
  const jerseyMap = new Map<string, number>();

  if (!selectedMatch) {
    return jerseyMap;
  }

  const tournamentMatchIds = new Set(
    matches
      .filter((match) => match.tournamentId === selectedMatch.tournamentId)
      .map((match) => match.id),
  );
  const inheritedJerseys = new Map<string, MatchJersey>();

  for (const matchJersey of matchJerseys) {
    if (!tournamentMatchIds.has(matchJersey.matchId)) {
      continue;
    }

    if (matchJersey.matchId === selectedMatch.id) {
      jerseyMap.set(matchJersey.playerId, matchJersey.jerseyNumber);
      continue;
    }

    const inheritedJersey = inheritedJerseys.get(matchJersey.playerId);

    if (
      !inheritedJersey ||
      matchJersey.updatedAt.localeCompare(inheritedJersey.updatedAt) > 0
    ) {
      inheritedJerseys.set(matchJersey.playerId, matchJersey);
    }
  }

  for (const [playerId, matchJersey] of inheritedJerseys) {
    if (!jerseyMap.has(playerId)) {
      jerseyMap.set(playerId, matchJersey.jerseyNumber);
    }
  }

  return jerseyMap;
}

function isMatchJersey(value: unknown): value is MatchJersey {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const matchJersey = value as Record<string, unknown>;

  return (
    typeof matchJersey.id === "string" &&
    typeof matchJersey.jerseyNumber === "number" &&
    typeof matchJersey.matchId === "string" &&
    typeof matchJersey.playerId === "string" &&
    typeof matchJersey.updatedAt === "string"
  );
}
