import {
  createAutomaticBackup,
  isBackupStorageKey,
} from "../../lib/automatic-backup";
import {
  createDeletionTombstone,
  isDeletionTombstone,
  isSharedStoreItem,
  readSharedStore,
  runSharedStoreOperation,
  writeSharedStore,
  type SharedStoreItem,
} from "../../lib/server-shared-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SavePayload = {
  items?: unknown;
  knownIds?: unknown;
};

const matchLockStorageKey = "3x3-tournament-manager:match-locks";
const responseHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

export function OPTIONS() {
  return new Response(null, {
    headers: responseHeaders,
    status: 204,
  });
}

export async function GET(request: Request) {
  const key = getStoreKey(request);

  if (!key) {
    return Response.json([], { status: 400 });
  }

  const { exists, items } = await runSharedStoreOperation(key, () =>
    readSharedStore(key),
  );

  return Response.json(items, {
    headers: {
      ...responseHeaders,
      "x-shared-store-exists": exists ? "1" : "0",
    },
  });
}

export async function PUT(request: Request) {
  const key = getStoreKey(request);

  if (!key) {
    return Response.json([], { status: 400 });
  }

  const payload = (await request.json().catch(() => ({}))) as SavePayload;
  const result = await runSharedStoreOperation(key, async () => {
    const { items: currentItems } = await readSharedStore(key);

    if (!Array.isArray(payload.items)) {
      return {
        items: currentItems,
        status: 400,
      };
    }

    const incomingItems = payload.items.filter(isSharedStoreItem);
    const knownIds = Array.isArray(payload.knownIds)
      ? payload.knownIds.filter((id): id is string => typeof id === "string")
      : [];
    const mergedItems = mergeItems(key, currentItems, incomingItems, knownIds);

    await writeSharedStore(key, mergedItems);

    return {
      items: mergedItems,
      status: 200,
    };
  });

  if (result.status === 200 && isBackupStorageKey(key)) {
    void createAutomaticBackup().catch((error) => {
      console.error("Automatski backup nije napravljen:", error);
    });
  }

  return Response.json(result.items, {
    headers: {
      ...responseHeaders,
      "x-shared-store-exists": "1",
    },
    status: result.status,
  });
}

function getStoreKey(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!key || key.length > 120) {
    return undefined;
  }

  return key;
}

function mergeItems(
  key: string,
  currentItems: SharedStoreItem[],
  incomingItems: SharedStoreItem[],
  knownIds: string[],
) {
  const currentItemsToMerge = isMatchLockStore(key)
    ? currentItems.filter((item) => !isExpiredMatchLock(item))
    : currentItems;
  const currentById = new Map(currentItemsToMerge.map((item) => [item.id, item]));
  const incomingIds = new Set(incomingItems.map((item) => item.id));
  const knownIdSet = new Set(knownIds);
  const mergedItems = incomingItems.map((incomingItem) => {
    const currentItem = currentById.get(incomingItem.id);

    return currentItem
      ? getLatestItem(key, currentItem, incomingItem)
      : incomingItem;
  });

  for (const currentItem of currentById.values()) {
    if (incomingIds.has(currentItem.id)) {
      continue;
    }

    if (isMatchLockStore(key) && !isExpiredMatchLock(currentItem)) {
      mergedItems.push(currentItem);
      continue;
    }

    if (!knownIdSet.has(currentItem.id)) {
      mergedItems.push(currentItem);
      continue;
    }

    if (!isMatchLockStore(key)) {
      mergedItems.push(createDeletionTombstone(currentItem.id));
    }
  }

  return mergedItems;
}

function getLatestItem(
  key: string,
  currentItem: SharedStoreItem,
  incomingItem: SharedStoreItem,
) {
  if (isMatchLockStore(key)) {
    return getLatestMatchLock(currentItem, incomingItem);
  }

  if (isDeletionTombstone(currentItem)) {
    return currentItem;
  }

  const currentTimestamp = getItemTimestamp(currentItem);
  const incomingTimestamp = getItemTimestamp(incomingItem);

  if (incomingTimestamp >= currentTimestamp) {
    return incomingItem;
  }

  return currentItem;
}

function getLatestMatchLock(
  currentItem: SharedStoreItem,
  incomingItem: SharedStoreItem,
) {
  const currentOwnerId = currentItem.ownerId;
  const incomingOwnerId = incomingItem.ownerId;
  const forceTakeover = incomingItem.forceTakeover === true;

  if (
    typeof currentOwnerId === "string" &&
    typeof incomingOwnerId === "string" &&
    currentOwnerId !== incomingOwnerId &&
    !isExpiredMatchLock(currentItem) &&
    !forceTakeover
  ) {
    return currentItem;
  }

  const currentTimestamp = getItemTimestamp(currentItem);
  const incomingTimestamp = getItemTimestamp(incomingItem);

  return incomingTimestamp >= currentTimestamp ? incomingItem : currentItem;
}

function isMatchLockStore(key: string) {
  return key === matchLockStorageKey;
}

function isExpiredMatchLock(item: SharedStoreItem) {
  const expiresAt = item.expiresAt;

  if (typeof expiresAt !== "string") {
    return true;
  }

  return Date.parse(expiresAt) <= Date.now();
}

function getItemTimestamp(item: SharedStoreItem) {
  const updatedAt = item.updatedAt;
  const createdAt = item.createdAt;

  if (typeof updatedAt === "string") {
    return updatedAt;
  }

  if (typeof createdAt === "string") {
    return createdAt;
  }

  return "";
}
