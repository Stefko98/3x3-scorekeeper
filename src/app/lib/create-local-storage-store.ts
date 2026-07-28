"use client";

import { useSyncExternalStore } from "react";
import { fetchWithTimeout } from "./fetch-with-timeout";
import { getSharedStoreUrl } from "./shared-server-url";

type LocalStorageStoreOptions<T> = {
  eventName: string;
  isItem: (value: unknown) => value is T;
  optimisticUpdates?: boolean;
  storageKey: string;
};

declare global {
  var __3X3_SHARED_STORES__: Record<string, unknown[]> | undefined;
}

const memoryStorage = new Map<string, string>();

export function createLocalStorageStore<T extends { id: string }>({
  eventName,
  isItem,
  optimisticUpdates = true,
  storageKey,
}: LocalStorageStoreOptions<T>) {
  const emptySnapshot: T[] = [];
  let cachedRaw = "";
  let cachedItems: T[] = emptySnapshot;
  let cachedServerItems: unknown[] | undefined;
  let cachedServerSnapshot: T[] = emptySnapshot;
  let listenerCount = 0;
  let pendingSave:
    | {
        items: T[];
        knownIds: Set<string>;
        revision: number;
      }
    | undefined;
  let pendingRemoteWrites = 0;
  let saveInFlight = false;
  let saveRevision = 0;
  let syncTimerId: number | undefined;

  function useItems() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }

  function saveItems(items: T[]) {
    const knownIds = getItemIds(readKnownItems());
    const pendingKnownIds = new Set(pendingSave?.knownIds ?? []);

    knownIds.forEach((id) => pendingKnownIds.add(id));
    saveRevision += 1;
    pendingSave = {
      items,
      knownIds: pendingKnownIds,
      revision: saveRevision,
    };

    if (optimisticUpdates) {
      updateLocalItems(items);
    }

    void flushPendingSave();
  }

  function subscribe(callback: () => void) {
    window.addEventListener(eventName, callback);
    window.addEventListener("storage", callback);
    listenerCount += 1;
    const initialCallbackTimerId = window.setTimeout(callback, 0);

    if (listenerCount === 1) {
      startSharedStoreSync();
    }

    return () => {
      window.clearTimeout(initialCallbackTimerId);
      window.removeEventListener(eventName, callback);
      window.removeEventListener("storage", callback);
      listenerCount = Math.max(0, listenerCount - 1);

      if (listenerCount === 0 && syncTimerId) {
        window.clearInterval(syncTimerId);
        syncTimerId = undefined;
      }
    };
  }

  function getSnapshot() {
    const raw = getLocalStorageSnapshot();

    if (raw === cachedRaw) {
      return cachedItems;
    }

    cachedRaw = raw;
    cachedItems = parseItems(raw, isItem);

    return cachedItems;
  }

  function getLocalStorageSnapshot() {
    const raw = getStoredRaw(storageKey);
    const sharedItems = globalThis.__3X3_SHARED_STORES__?.[storageKey];

    if (
      (raw === null || (raw === "[]" && cachedRaw === "")) &&
      Array.isArray(sharedItems) &&
      sharedItems.length > 0
    ) {
      const sharedRaw = JSON.stringify(sharedItems);
      setStoredRaw(storageKey, sharedRaw);

      return sharedRaw;
    }

    return raw ?? "[]";
  }

  function getServerSnapshot() {
    const sharedItems = globalThis.__3X3_SHARED_STORES__?.[storageKey];

    if (!Array.isArray(sharedItems)) {
      return emptySnapshot;
    }

    if (sharedItems === cachedServerItems) {
      return cachedServerSnapshot;
    }

    cachedServerItems = sharedItems;
    cachedServerSnapshot = sharedItems.filter(isItem);

    return cachedServerSnapshot;
  }

  function startSharedStoreSync() {
    void loadItemsFromSharedStore();
    syncTimerId = window.setInterval(loadItemsFromSharedStore, 1_000);
  }

  async function loadItemsFromSharedStore() {
    if (pendingSave) {
      await flushPendingSave();

      if (pendingSave) {
        return;
      }
    }

    if (pendingRemoteWrites > 0) {
      return;
    }

    try {
      const response = await fetchWithTimeout(getSharedStoreUrl(storageKey), {
        cache: "no-store",
      });

      if (!response.ok) {
        dispatchSharedStoreStatus("offline");
        return;
      }

      dispatchSharedStoreStatus("online");
      const sharedRaw = await response.text();
      const sharedItems = parseItems(sharedRaw, isItem);
      const storeExists = response.headers.get("x-shared-store-exists") === "1";
      const localItems = readLocalItems();

      if (!storeExists && localItems.length > 0) {
        saveItems(localItems);
        return;
      }

      if (sharedRaw !== cachedRaw) {
        updateLocalItems(sharedItems);
      }
    } catch {
      dispatchSharedStoreStatus("offline");
      // The app still works locally if the shared server is not reachable.
    }
  }

  async function flushPendingSave() {
    if (saveInFlight || !pendingSave) {
      return;
    }

    const save = pendingSave;
    saveInFlight = true;
    pendingRemoteWrites += 1;

    try {
      const response = await fetchWithTimeout(getSharedStoreUrl(storageKey), {
        body: JSON.stringify({
          items: save.items,
          knownIds: [...save.knownIds],
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });

      if (!response.ok) {
        dispatchSharedStoreStatus("offline");
        return;
      }

      dispatchSharedStoreStatus("online");
      const sharedRaw = await response.text();
      const hasNewerSave = pendingSave?.revision !== save.revision;

      if (!hasNewerSave) {
        pendingSave = undefined;
        updateLocalItems(parseItems(sharedRaw, isItem));
      }
    } catch {
      dispatchSharedStoreStatus("offline");
      // Keep the latest save queued. The one-second sync cycle retries it.
    } finally {
      pendingRemoteWrites = Math.max(0, pendingRemoteWrites - 1);
      saveInFlight = false;

      if (pendingSave && pendingSave.revision !== save.revision) {
        void flushPendingSave();
      }
    }
  }

  function readLocalItems() {
    return parseItems(getStoredRaw(storageKey) ?? "[]", isItem);
  }

  function readKnownItems() {
    const localItems = readLocalItems();

    if (localItems.length > 0) {
      return localItems;
    }

    if (cachedItems.length > 0) {
      return cachedItems;
    }

    const sharedItems = globalThis.__3X3_SHARED_STORES__?.[storageKey];

    if (Array.isArray(sharedItems)) {
      return sharedItems.filter(isItem);
    }

    return [];
  }

  function updateLocalItems(items: T[]) {
    const serialized = JSON.stringify(items);
    cachedRaw = serialized;
    cachedItems = items;

    setStoredRaw(storageKey, serialized);
    window.dispatchEvent(new Event(eventName));
  }

  return {
    saveItems,
    useItems,
  };
}

function parseItems<T extends { id: string }>(
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

function getItemIds<T extends { id: string }>(items: T[]) {
  return items.map((item) => item.id);
}

function getStoredRaw(storageKey: string) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(storageKey);
    }
  } catch {
    // Browsers can block localStorage on plain network addresses or privacy modes.
  }

  return memoryStorage.get(storageKey) ?? null;
}

function setStoredRaw(storageKey: string, raw: string) {
  memoryStorage.set(storageKey, raw);

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(storageKey, raw);
    }
  } catch {
    // The shared server remains the source of truth when localStorage is blocked.
  }
}

function dispatchSharedStoreStatus(status: "offline" | "online") {
  window.dispatchEvent(
    new CustomEvent("3x3-shared-store-status", {
      detail: {
        checkedAt: new Date().toISOString(),
        status,
      },
    }),
  );
}
