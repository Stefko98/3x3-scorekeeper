import type { Metadata } from "next";
import { AppShell } from "../app-shell";
import { PlayerManagerClient } from "./player-manager-client";

export const metadata: Metadata = {
  title: "Igrači | 3x3 Organizator",
  description: "Upravljanje igračima i spiskovima za 3x3 ekipe.",
};

export default function PlayersPage() {
  return (
    <AppShell activeModule="Igrači">
      <PlayerManagerClient />
    </AppShell>
  );
}
