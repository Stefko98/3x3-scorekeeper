import { readFile } from "fs/promises";
import path from "path";
import { SharedStoreHydrator } from "./shared-store-hydrator";

const sharedStores = [
  {
    eventName: "3x3-tournaments-updated",
    storageKey: "3x3-tournament-manager:tournaments",
  },
  {
    eventName: "3x3-teams-updated",
    storageKey: "3x3-tournament-manager:teams",
  },
  {
    eventName: "3x3-players-updated",
    storageKey: "3x3-tournament-manager:players",
  },
  {
    eventName: "3x3-matches-updated",
    storageKey: "3x3-tournament-manager:matches",
  },
  {
    eventName: "3x3-match-events-updated",
    storageKey: "3x3-tournament-manager:match-events",
  },
  {
    eventName: "3x3-match-locks-updated",
    storageKey: "3x3-tournament-manager:match-locks",
  },
];

const dataDirectory = path.join(process.cwd(), ".shared-data");

export async function SharedStoreBootstrap() {
  const stores = await Promise.all(
    sharedStores.map(async (store) => ({
      ...store,
      items: await readSharedStore(store.storageKey),
    })),
  );
  Reflect.set(
    globalThis,
    "__3X3_SHARED_STORES__",
    Object.fromEntries(stores.map((store) => [store.storageKey, store.items])),
  );

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: createBootstrapScript(stores),
        }}
      />
      <SharedStoreHydrator stores={stores} />
    </>
  );
}

async function readSharedStore(storageKey: string) {
  try {
    const raw = await readFile(getStorePath(storageKey), "utf8");
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getStorePath(storageKey: string) {
  const fileName = Buffer.from(storageKey).toString("base64url");

  return path.join(dataDirectory, `${fileName}.json`);
}

function createBootstrapScript(
  stores: Array<{
    eventName: string;
    items: unknown[];
    storageKey: string;
  }>,
) {
  return `(() => {
  const stores = ${escapeScriptJson(stores)};
  window.__3X3_SHARED_STORES__ = Object.fromEntries(stores.map((store) => [store.storageKey, store.items]));
  for (const store of stores) {
    try {
      window.localStorage.setItem(store.storageKey, JSON.stringify(store.items));
      window.dispatchEvent(new Event(store.eventName));
    } catch {}
  }
})();`;
}

function escapeScriptJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
