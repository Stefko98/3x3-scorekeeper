"use client";

import { useEffect, useState } from "react";
import { fetchWithTimeout } from "./lib/fetch-with-timeout";
import {
  getSharedServerLabel,
  getSharedStoreUrl,
} from "./lib/shared-server-url";

type SyncStatus = "checking" | "offline" | "online";

type SyncStatusEvent = CustomEvent<{
  checkedAt: string;
  status: "offline" | "online";
}>;

export function SharedSyncStatus() {
  const [checkedAt, setCheckedAt] = useState("");
  const [serverLabel] = useState(() => getSharedServerLabel());
  const [status, setStatus] = useState<SyncStatus>("checking");

  async function checkSharedStore() {
    try {
      const response = await fetchWithTimeout(
        getSharedStoreUrl("3x3-tournament-manager:tournaments"),
        {
          cache: "no-store",
        },
      );

      setCheckedAt(new Date().toISOString());
      setStatus(response.ok ? "online" : "offline");
    } catch {
      setCheckedAt(new Date().toISOString());
      setStatus("offline");
    }
  }

  useEffect(() => {
    const firstCheckTimerId = window.setTimeout(checkSharedStore, 0);
    const timerId = window.setInterval(checkSharedStore, 4_000);
    const handleSyncStatus = (event: Event) => {
      const syncEvent = event as SyncStatusEvent;

      setCheckedAt(syncEvent.detail.checkedAt);
      setStatus(syncEvent.detail.status);
    };

    window.addEventListener("3x3-shared-store-status", handleSyncStatus);

    return () => {
      window.clearTimeout(firstCheckTimerId);
      window.clearInterval(timerId);
      window.removeEventListener("3x3-shared-store-status", handleSyncStatus);
    };
  }, []);

  return (
    <div className="mt-4 rounded-md border border-white/10 bg-[#0F172A] px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            status === "online"
              ? "bg-[#22C55E]"
              : status === "offline"
                ? "bg-[#EF4444]"
                : "bg-[#FACC15]"
          }`}
        />
        <p className="text-xs font-black text-white">
          {status === "online"
            ? "Sinhronizacija povezana"
            : status === "offline"
              ? "Nema veze sa bazom"
              : "Provera sinhronizacije"}
        </p>
      </div>
      {checkedAt && (
        <p className="mt-1 text-[11px] font-semibold text-[#94A3B8]">
          Baza: {serverLabel} / Poslednja provera {formatTime(checkedAt)}
        </p>
      )}
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("sr-RS", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
