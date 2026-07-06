import type { Metadata } from "next";
import { AppShell } from "../app-shell";
import { PlayerManagerClient } from "./player-manager-client";

export const metadata: Metadata = {
  title: "Igraci | 3x3 Tournament Manager",
  description: "Upravljanje igracima i rosterima za 3x3 ekipe.",
};

export default function PlayersPage() {
  return (
    <AppShell activeModule="Igraci">
      <PlayerManagerClient />
    </AppShell>
  );
}
