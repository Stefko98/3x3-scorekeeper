import type { Metadata } from "next";
import { AppShell } from "../app-shell";
import { LiveScoreClient } from "./live-score-client";

export const metadata: Metadata = {
  title: "Rezultat uživo | 3x3 Organizator",
  description: "Interaktivni ekran za vođenje 3x3 rezultata.",
};

type LiveScorePageProps = {
  searchParams: Promise<{
    matchId?: string | string[];
  }>;
};

export default async function LiveScorePage({
  searchParams,
}: LiveScorePageProps) {
  const params = await searchParams;
  const initialMatchId = Array.isArray(params.matchId)
    ? params.matchId[0]
    : params.matchId;

  return (
    <AppShell activeModule="Rezultat uživo">
      <LiveScoreClient
        initialMatchId={initialMatchId}
        key={initialMatchId ?? "live-score"}
      />
    </AppShell>
  );
}
