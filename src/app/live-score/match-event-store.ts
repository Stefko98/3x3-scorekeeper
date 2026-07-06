"use client";

import { createLocalStorageStore } from "../lib/create-local-storage-store";

export type MatchEventType =
  | "POINT"
  | "FOUL"
  | "START_MATCH"
  | "PAUSE_MATCH"
  | "RESUME_MATCH"
  | "FINISH_MATCH"
  | "DELETE_EVENT";

export type MatchEvent = {
  clock: string;
  createdAt: string;
  deletedEventId?: string;
  description?: string;
  id: string;
  isDeleted: boolean;
  matchId: string;
  playerId?: string;
  points?: 1 | 2;
  teamId?: string;
  tournamentId: string;
  type: MatchEventType;
};

const matchEventStore = createLocalStorageStore<MatchEvent>({
  eventName: "3x3-match-events-updated",
  isItem: isMatchEvent,
  storageKey: "3x3-tournament-manager:match-events",
});

export const useMatchEvents = matchEventStore.useItems;
export const saveMatchEvents = matchEventStore.saveItems;

function isMatchEvent(value: unknown): value is MatchEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const event = value as Record<string, unknown>;

  return (
    typeof event.clock === "string" &&
    typeof event.createdAt === "string" &&
    typeof event.id === "string" &&
    typeof event.isDeleted === "boolean" &&
    typeof event.matchId === "string" &&
    typeof event.tournamentId === "string" &&
    typeof event.type === "string"
  );
}
