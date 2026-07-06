"use client";

import { createLocalStorageStore } from "../lib/create-local-storage-store";

export type PlayerPosition = "GUARD" | "WING" | "BIG" | "FLEX";

export type Player = {
  createdAt: string;
  firstName: string;
  id: string;
  jerseyNumber: number;
  lastName: string;
  nickname: string;
  position: PlayerPosition;
  teamId: string;
  tournamentId: string;
  updatedAt: string;
};

const playerStore = createLocalStorageStore<Player>({
  eventName: "3x3-players-updated",
  isItem: isPlayer,
  storageKey: "3x3-tournament-manager:players",
});

export const usePlayers = playerStore.useItems;
export const savePlayers = playerStore.saveItems;

export function getPlayerDisplayName(player: Player) {
  const name = `${player.firstName} ${player.lastName}`.trim();

  if (!player.nickname.trim()) {
    return name;
  }

  return `${name} "${player.nickname.trim()}"`;
}

function isPlayer(value: unknown): value is Player {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const player = value as Record<string, unknown>;

  return (
    typeof player.firstName === "string" &&
    typeof player.id === "string" &&
    typeof player.jerseyNumber === "number" &&
    typeof player.lastName === "string" &&
    typeof player.teamId === "string" &&
    typeof player.tournamentId === "string"
  );
}
