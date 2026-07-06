"use client";

import { useSyncExternalStore } from "react";

type LocalStorageStoreOptions<T> = {
  eventName: string;
  isItem: (value: unknown) => value is T;
  storageKey: string;
};

export function createLocalStorageStore<T>({
  eventName,
  isItem,
  storageKey,
}: LocalStorageStoreOptions<T>) {
  const emptySnapshot: T[] = [];
  let cachedRaw = "";
  let cachedItems: T[] = emptySnapshot;

  function useItems() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }

  function saveItems(items: T[]) {
    const serialized = JSON.stringify(items);
    cachedRaw = serialized;
    cachedItems = items;

    window.localStorage.setItem(storageKey, serialized);
    window.dispatchEvent(new Event(eventName));
  }

  function subscribe(callback: () => void) {
    window.addEventListener(eventName, callback);
    window.addEventListener("storage", callback);

    return () => {
      window.removeEventListener(eventName, callback);
      window.removeEventListener("storage", callback);
    };
  }

  function getSnapshot() {
    const raw = window.localStorage.getItem(storageKey) ?? "[]";

    if (raw === cachedRaw) {
      return cachedItems;
    }

    cachedRaw = raw;
    cachedItems = parseItems(raw, isItem);

    return cachedItems;
  }

  function getServerSnapshot() {
    return emptySnapshot;
  }

  return {
    saveItems,
    useItems,
  };
}

function parseItems<T>(
  raw: string,
  isItem: (value: unknown) => value is T,
): T[] {
  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isItem);
  } catch {
    return [];
  }
}
