"use client";

import { useSyncExternalStore } from "react";

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
  numberOfCourts: number;
  maxTeams: number;
  status: TournamentStatus;
  tournamentType: TournamentType;
  registrationOpen: boolean;
  publicSlug: string;
  createdAt: string;
  updatedAt: string;
};

const storageKey = "3x3-tournament-manager:tournaments";
const storeEventName = "3x3-tournaments-updated";
const emptyTournamentSnapshot: Tournament[] = [];

let cachedRaw = "";
let cachedTournaments: Tournament[] = [];

export function useTournaments() {
  return useSyncExternalStore(
    subscribeToTournamentStore,
    getTournamentSnapshot,
    getServerTournamentSnapshot,
  );
}

export function saveTournaments(tournaments: Tournament[]) {
  const serialized = JSON.stringify(tournaments);
  cachedRaw = serialized;
  cachedTournaments = tournaments;

  window.localStorage.setItem(storageKey, serialized);
  window.dispatchEvent(new Event(storeEventName));
}

function subscribeToTournamentStore(callback: () => void) {
  window.addEventListener(storeEventName, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(storeEventName, callback);
    window.removeEventListener("storage", callback);
  };
}

function getTournamentSnapshot() {
  const raw = window.localStorage.getItem(storageKey) ?? "[]";

  if (raw === cachedRaw) {
    return cachedTournaments;
  }

  cachedRaw = raw;
  cachedTournaments = parseTournaments(raw);

  return cachedTournaments;
}

function getServerTournamentSnapshot() {
  return emptyTournamentSnapshot;
}

function parseTournaments(raw: string): Tournament[] {
  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isTournament);
  } catch {
    return [];
  }
}

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
