import type { Metadata } from "next";
import { AppShell } from "../app-shell";
import { StandingsClient } from "./standings-client";

export const metadata: Metadata = {
  title: "Tabele | 3x3 Tournament Manager",
  description: "Tabele, poredak i rezultati po grupama za 3x3 turnire.",
};

export default function StandingsPage() {
  return (
    <AppShell activeModule="Tabele">
      <StandingsClient />
    </AppShell>
  );
}
