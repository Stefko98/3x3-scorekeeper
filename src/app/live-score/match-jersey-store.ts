"use client";

import { createLocalStorageStore } from "../lib/create-local-storage-store";

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
