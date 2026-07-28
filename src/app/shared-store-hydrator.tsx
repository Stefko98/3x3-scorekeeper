"use client";

import { useEffect } from "react";

type SharedStorePayload = {
  eventName: string;
  items: unknown[];
  storageKey: string;
};

export function SharedStoreHydrator({
  stores,
}: {
  stores: SharedStorePayload[];
}) {
  useEffect(() => {
    globalThis.__3X3_SHARED_STORES__ = Object.fromEntries(
      stores.map((store) => [store.storageKey, store.items]),
    );

    for (const store of stores) {
      try {
        window.localStorage.setItem(
          store.storageKey,
          JSON.stringify(store.items),
        );
        window.dispatchEvent(new Event(store.eventName));
      } catch {}
    }
  }, [stores]);

  return null;
}
