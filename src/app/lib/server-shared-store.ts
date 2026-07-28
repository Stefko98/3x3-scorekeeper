import { randomUUID } from "crypto";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import path from "path";

export type SharedStoreItem = Record<string, unknown> & {
  id: string;
};

const dataDirectory = path.join(process.cwd(), ".shared-data");
const storeOperationQueues = new Map<string, Promise<unknown>>();

export async function readSharedStore(key: string) {
  try {
    const raw = await readFile(getSharedStorePath(key), "utf8");
    const parsed = JSON.parse(raw);

    return {
      exists: true,
      items: Array.isArray(parsed) ? parsed.filter(isSharedStoreItem) : [],
    };
  } catch {
    return {
      exists: false,
      items: [] as SharedStoreItem[],
    };
  }
}

export async function writeSharedStore(
  key: string,
  items: SharedStoreItem[],
) {
  await mkdir(dataDirectory, { recursive: true });

  const storePath = getSharedStorePath(key);
  const temporaryPath = `${storePath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, JSON.stringify(items, null, 2), "utf8");
    await replaceStoreFile(temporaryPath, storePath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

export async function runSharedStoreOperation<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previousOperation =
    storeOperationQueues.get(key) ?? Promise.resolve();
  const nextOperation = previousOperation
    .catch(() => undefined)
    .then(operation);

  storeOperationQueues.set(key, nextOperation);

  try {
    return await nextOperation;
  } finally {
    if (storeOperationQueues.get(key) === nextOperation) {
      storeOperationQueues.delete(key);
    }
  }
}

export function isSharedStoreItem(
  value: unknown,
): value is SharedStoreItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === "string"
  );
}

export function isDeletionTombstone(item: SharedStoreItem) {
  return item.__deleted === true;
}

export function createDeletionTombstone(
  id: string,
  updatedAt = new Date().toISOString(),
): SharedStoreItem {
  return {
    __deleted: true,
    id,
    updatedAt,
  };
}

async function replaceStoreFile(
  temporaryPath: string,
  storePath: string,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rename(temporaryPath, storePath);
      return;
    } catch (error) {
      if (!isRetryableFileError(error)) {
        throw error;
      }

      lastError = error;
    }

    try {
      await rm(storePath, { force: true });
      await rename(temporaryPath, storePath);
      return;
    } catch (error) {
      if (!isRetryableFileError(error)) {
        throw error;
      }

      lastError = error;
      await wait(20 * (attempt + 1));
    }
  }

  throw lastError;
}

function getSharedStorePath(key: string) {
  const fileName = Buffer.from(key).toString("base64url");

  return path.join(dataDirectory, `${fileName}.json`);
}

function isRetryableFileError(error: unknown) {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }

  return ["EACCES", "EBUSY", "EEXIST", "ENOENT", "EPERM"].includes(
    String(error.code),
  );
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
