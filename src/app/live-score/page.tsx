import type { Metadata } from "next";
import { AppShell } from "../app-shell";
import { LiveScoreClient } from "./live-score-client";

export const metadata: Metadata = {
  title: "Live Score | 3x3 Tournament Manager",
  description: "Interaktivni live scoring ekran za 3x3 utakmicu.",
};

export default function LiveScorePage() {
  return (
    <AppShell activeModule="Live Score">
      <LiveScoreClient />
    </AppShell>
  );
}
