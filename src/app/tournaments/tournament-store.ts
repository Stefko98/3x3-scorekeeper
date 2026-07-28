"use client";

import { createLocalStorageStore } from "../lib/create-local-storage-store";

export type TournamentStatus =
  | "DRAFT"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "ONGOING"
  | "FINISHED"
  | "CANCELLED";

export type TournamentType =
  | "GROUP_STAGE"
  | "KNOCKOUT"
  | "GROUPS_AND_KNOCKOUT"
  | "LEAGUE";

export type Tournament = {
  id: string;
  name: string;
  description: string;
  location: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  groupCount?: number;
  knockoutTeams?: number;
  numberOfCourts: number;
  maxTeams: number;
  status: TournamentStatus;
  tournamentType: TournamentType;
  registrationOpen: boolean;
  publicSlug: string;
  createdAt: string;
  updatedAt: string;
};

const tournamentStore = createLocalStorageStore<Tournament>({
  eventName: "3x3-tournaments-updated",
  isItem: isTournament,
  storageKey: "3x3-tournament-manager:tournaments",
});

export const useTournaments = tournamentStore.useItems;
export const saveTournaments = tournamentStore.saveItems;

function isTournament(value: unknown): value is Tournament {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const tournament = value as Record<string, unknown>;

  return (
    typeof tournament.id === "string" &&
    typeof tournament.name === "string" &&
    typeof tournament.city === "string" &&
    typeof tournament.startDate === "string" &&
    typeof tournament.endDate === "string" &&
    typeof tournament.publicSlug === "string"
  );
}
