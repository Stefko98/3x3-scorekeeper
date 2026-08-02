"use client";

import { createLocalStorageStore } from "../lib/create-local-storage-store";

export type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "PAUSED"
  | "FINISHED"
  | "CANCELLED";

export type MatchPhase =
  | "GROUP_STAGE"
  | "QUARTER_FINAL"
  | "SEMI_FINAL"
  | "THIRD_PLACE"
  | "FINAL";

export type LegacyMatchType =
  | "GROUP_MATCH"
  | "QUARTER_FINAL"
  | "SEMI_FINAL"
  | "FINAL"
  | "THIRD_PLACE"
  | "FRIENDLY";

export type Match = {
  clockRemainingSeconds?: number;
  clockUpdatedAt?: string;
  courtName: string;
  createdAt: string;
  finishedAt?: string;
  foulsA: number;
  foulsB: number;
  id: string;
  matchPhase: MatchPhase;
  matchType?: LegacyMatchType;
  overtimeStartedAt?: string;
  overtimeStartingScoreA?: number;
  overtimeStartingScoreB?: number;
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

export const matchPhaseLabels: Record<MatchPhase, string> = {
  FINAL: "Finale",
  GROUP_STAGE: "Grupna faza",
  QUARTER_FINAL: "Četvrtfinale",
  SEMI_FINAL: "Polufinale",
  THIRD_PLACE: "Za treće mesto",
};

export function getMatchPhase(match: Match): MatchPhase {
  if (match.matchPhase) {
    return match.matchPhase;
  }

  if (match.matchType === "QUARTER_FINAL") {
    return "QUARTER_FINAL";
  }

  if (match.matchType === "SEMI_FINAL") {
    return "SEMI_FINAL";
  }

  if (match.matchType === "FINAL") {
    return "FINAL";
  }

  if (match.matchType === "THIRD_PLACE") {
    return "THIRD_PLACE";
  }

  return "GROUP_STAGE";
}

export function isKnockoutPhase(match: Match) {
  return getMatchPhase(match) !== "GROUP_STAGE";
}

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
