"use client";

import { createLocalStorageStore } from "../lib/create-local-storage-store";

export type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "PAUSED"
  | "FINISHED"
  | "CANCELLED";

export type MatchType =
  | "GROUP_MATCH"
  | "QUARTER_FINAL"
  | "SEMI_FINAL"
  | "FINAL"
  | "THIRD_PLACE"
  | "FRIENDLY";

export type Match = {
  courtName: string;
  createdAt: string;
  finishedAt?: string;
  foulsA: number;
  foulsB: number;
  id: string;
  matchType: MatchType;
  scheduledTime: string;
  scoreA: number;
  scoreB: number;
  startedAt?: string;
  status: MatchStatus;
  teamAId: string;
  teamBId: string;
  tournamentId: string;
  updatedAt: string;
  winnerTeamId?: string;
};

const matchStore = createLocalStorageStore<Match>({
  eventName: "3x3-matches-updated",
  isItem: isMatch,
  storageKey: "3x3-tournament-manager:matches",
});

export const useMatches = matchStore.useItems;
export const saveMatches = matchStore.saveItems;

function isMatch(value: unknown): value is Match {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const match = value as Record<string, unknown>;

  return (
    typeof match.courtName === "string" &&
    typeof match.foulsA === "number" &&
    typeof match.foulsB === "number" &&
    typeof match.id === "string" &&
    typeof match.scoreA === "number" &&
    typeof match.scoreB === "number" &&
    typeof match.status === "string" &&
    typeof match.teamAId === "string" &&
    typeof match.teamBId === "string" &&
    typeof match.tournamentId === "string"
  );
}
