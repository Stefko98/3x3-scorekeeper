"use client";

import { createLocalStorageStore } from "../lib/create-local-storage-store";

export type TeamStatus =
  | "REGISTERED"
  | "CONFIRMED"
  | "DISQUALIFIED"
  | "WITHDRAWN";

export type Team = {
  city: string;
  contactEmail: string;
  contactPerson: string;
  contactPhone: string;
  createdAt: string;
  groupName: string;
  id: string;
  name: string;
  status: TeamStatus;
  tournamentId: string;
  updatedAt: string;
};

const teamStore = createLocalStorageStore<Team>({
  eventName: "3x3-teams-updated",
  isItem: isTeam,
  storageKey: "3x3-tournament-manager:teams",
});

export const useTeams = teamStore.useItems;
export const saveTeams = teamStore.saveItems;

function isTeam(value: unknown): value is Team {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const team = value as Record<string, unknown>;

  return (
    typeof team.city === "string" &&
    typeof team.id === "string" &&
    typeof team.name === "string" &&
    typeof team.status === "string" &&
    typeof team.tournamentId === "string"
  );
}
