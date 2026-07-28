"use client";

const sharedServerStorageKey = "3x3-tournament-manager:shared-server-url";

export function getSharedStoreUrl(storageKey: string) {
  return getSharedApiUrl(
    `/api/shared-store?key=${encodeURIComponent(storageKey)}`,
  );
}

export function getSharedApiUrl(path: string) {
  const baseUrl = getSharedServerBaseUrl();

  return baseUrl ? `${baseUrl}${path}` : path;
}

export function getSharedServerBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  const queryUrl = getSharedServerUrlFromQuery();

  if (queryUrl) {
    setStoredSharedServerUrl(queryUrl);
    return queryUrl;
  }

  return getStoredSharedServerUrl() ?? "";
}

export function getSharedServerLabel() {
  const baseUrl = getSharedServerBaseUrl();

  if (!baseUrl) {
    return "ovaj računar";
  }

  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

function getSharedServerUrlFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("server") ?? params.get("sharedServer");

    return normalizeSharedServerUrl(value);
  } catch {
    return undefined;
  }
}

function getStoredSharedServerUrl() {
  try {
    return normalizeSharedServerUrl(
      window.localStorage.getItem(sharedServerStorageKey),
    );
  } catch {
    return undefined;
  }
}

function setStoredSharedServerUrl(value: string) {
  try {
    window.localStorage.setItem(sharedServerStorageKey, value);
  } catch {
    // The URL is still usable for this browser session through the query string.
  }
}

function normalizeSharedServerUrl(value: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}
