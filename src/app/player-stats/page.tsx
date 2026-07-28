import type { Metadata } from "next";
import { AppShell } from "../app-shell";
import { PlayerStats } from "./player-stats-client";

export const metadata: Metadata = {
  title: "Statistika igrača | 3x3 Organizator",
  description:
    "Kompletna statistika igrača i ekipa, MVP rang-lista i rekordi 3x3 turnira.",
};

export default function PlayerStatsPage() {
  return (
    <AppShell activeModule="Statistika">
      <PlayerStats />
    </AppShell>
  );
}
