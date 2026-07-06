import type { Metadata } from "next";
import { AppShell } from "../app-shell";
import { PlayerStats } from "./player-stats-client";

export const metadata: Metadata = {
  title: "Statistika igraca | 3x3 Tournament Manager",
  description: "Top 5 liste igraca po poenima, sutevima i faulovima.",
};

export default function PlayerStatsPage() {
  return (
    <AppShell activeModule="Statistika">
      <PlayerStats />
    </AppShell>
  );
}
