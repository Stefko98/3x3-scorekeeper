import type { Metadata } from "next";
import { AppShell } from "../app-shell";
import { TournamentManagerClient } from "./tournament-manager-client";

export const metadata: Metadata = {
  title: "Turniri | 3x3 Organizator",
  description: "Kreiranje i upravljanje 3x3 turnirima.",
};

export default function TournamentsPage() {
  return (
    <AppShell activeModule="Turniri">
      <TournamentManagerClient />
    </AppShell>
  );
}
