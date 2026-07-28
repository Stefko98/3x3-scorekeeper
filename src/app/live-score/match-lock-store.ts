"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLocalStorageStore } from "../lib/create-local-storage-store";
import { createId } from "../lib/id";

export type MatchLock = {
  acquiredAt: string;
  expiresAt: string;
  forceTakeover?: boolean;
  id: string;
  matchId: string;
  ownerId: string;
  ownerLabel: string;
  updatedAt: string;
};

const scorekeeperStorageKey = "3x3-tournament-manager:scorekeeper-id";
const lockDurationMs = 6_000;
const renewIntervalMs = 2_000;

const matchLockStore = createLocalStorageStore<MatchLock>({
  eventName: "3x3-match-locks-updated",
  isItem: isMatchLock,
  optimisticUpdates: false,
  storageKey: "3x3-tournament-manager:match-locks",
});

export const useMatchLocks = matchLockStore.useItems;
export const saveMatchLocks = matchLockStore.saveItems;

export function useMatchLock(matchId?: string) {
  const locks = useMatchLocks();
  const locksRef = useRef(locks);
  const ownerId = useScorekeeperId();
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    locksRef.current = locks;
  }, [locks]);

  useEffect(() => {
    const initialTimerId = window.setTimeout(() => setNowMs(Date.now()), 0);
    const timerId = window.setInterval(() => setNowMs(Date.now()), 1_000);

    return () => {
      window.clearTimeout(initialTimerId);
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    if (!matchId || !ownerId) {
      return;
    }

    const lockedMatchId = matchId;

    function renewLock() {
      const currentNowMs = Date.now();
      const currentLocks = removeExpiredLocks(locksRef.current, currentNowMs);
      const activeLock = currentLocks.find(
        (lock) => lock.matchId === lockedMatchId,
      );

      if (activeLock && activeLock.ownerId !== ownerId) {
        return;
      }

      const now = new Date(currentNowMs).toISOString();
      const nextLock: MatchLock = {
        acquiredAt: activeLock?.acquiredAt ?? now,
        expiresAt: new Date(currentNowMs + lockDurationMs).toISOString(),
        id: getMatchLockId(lockedMatchId),
        matchId: lockedMatchId,
        ownerId,
        ownerLabel: getOwnerLabel(ownerId),
        updatedAt: now,
      };

      saveMatchLocks([
        ...currentLocks.filter((lock) => lock.matchId !== lockedMatchId),
        nextLock,
      ]);
    }

    renewLock();
    const timerId = window.setInterval(renewLock, renewIntervalMs);

    return () => {
      window.clearInterval(timerId);
      const activeLock = locksRef.current.find(
        (lock) => lock.matchId === lockedMatchId,
      );

      if (activeLock?.ownerId === ownerId) {
        saveMatchLocks(
          locksRef.current.filter((lock) => lock.matchId !== lockedMatchId),
        );
      }
    };
  }, [matchId, ownerId]);

  const takeControl = useCallback(() => {
    if (!matchId || !ownerId) {
      return;
    }

    const currentNowMs = Date.now();
    const currentLocks = removeExpiredLocks(locksRef.current, currentNowMs);
    const now = new Date(currentNowMs).toISOString();
    const nextLock: MatchLock = {
      acquiredAt: now,
      expiresAt: new Date(currentNowMs + lockDurationMs).toISOString(),
      forceTakeover: true,
      id: getMatchLockId(matchId),
      matchId,
      ownerId,
      ownerLabel: getOwnerLabel(ownerId),
      updatedAt: now,
    };

    saveMatchLocks([
      ...currentLocks.filter((lock) => lock.matchId !== matchId),
      nextLock,
    ]);
  }, [matchId, ownerId]);

  return useMemo(() => {
    const activeLock = locks.find(
      (lock) =>
        lock.matchId === matchId &&
        Date.parse(lock.expiresAt) > nowMs,
    );
    const lockedByCurrentDevice =
      Boolean(activeLock) && activeLock?.ownerId === ownerId;
    const lockedByOtherDevice =
      Boolean(activeLock) && activeLock?.ownerId !== ownerId;

    return {
      activeLock,
      isReady: Boolean(matchId && ownerId),
      lockedByCurrentDevice,
      lockedByOtherDevice,
      ownerLabel: activeLock?.ownerLabel,
      takeControl,
    };
  }, [locks, matchId, nowMs, ownerId, takeControl]);
}

function useScorekeeperId() {
  const [scorekeeperId, setScorekeeperId] = useState("");

  useEffect(() => {
    if (scorekeeperId) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setScorekeeperId(readOrCreateScorekeeperId());
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [scorekeeperId]);

  return scorekeeperId;
}

function readOrCreateScorekeeperId() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const storedScorekeeperId = window.localStorage.getItem(
      scorekeeperStorageKey,
    );

    if (storedScorekeeperId) {
      return storedScorekeeperId;
    }

    const nextScorekeeperId = createId("scorekeeper");
    window.localStorage.setItem(scorekeeperStorageKey, nextScorekeeperId);

    return nextScorekeeperId;
  } catch {
    return createId("scorekeeper");
  }
}

function getMatchLockId(matchId: string) {
  return `match-lock:${matchId}`;
}

function getOwnerLabel(ownerId: string) {
  const suffix = ownerId.slice(-4).toUpperCase();

  return `Prozor ${suffix}`;
}

function removeExpiredLocks(locks: MatchLock[], nowMs: number) {
  return locks.filter((lock) => Date.parse(lock.expiresAt) > nowMs);
}

function isMatchLock(value: unknown): value is MatchLock {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const lock = value as Record<string, unknown>;

  return (
    typeof lock.acquiredAt === "string" &&
    typeof lock.expiresAt === "string" &&
    typeof lock.id === "string" &&
    typeof lock.matchId === "string" &&
    typeof lock.ownerId === "string" &&
    typeof lock.ownerLabel === "string" &&
    typeof lock.updatedAt === "string"
  );
}
