import type { Metadata } from "next";
import { AppShell } from "../app-shell";
import { MatchManagerClient } from "./match-manager-client";

export const metadata: Metadata = {
  title: "Utakmice | 3x3 Tournament Manager",
  description: "Raspored i statusi 3x3 utakmica.",
};

export default function MatchesPage() {
  return (
    <AppShell activeModule="Utakmice">
      <MatchManagerClient />
    </AppShell>
  );
}
