import type { Metadata } from "next";
import { AppShell } from "../app-shell";
import { TeamManagerClient } from "./team-manager-client";

export const metadata: Metadata = {
  title: "Ekipe | 3x3 Tournament Manager",
  description: "Upravljanje ekipama za 3x3 turnire.",
};

export default function TeamsPage() {
  return (
    <AppShell activeModule="Ekipe">
      <TeamManagerClient />
    </AppShell>
  );
}
