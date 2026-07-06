import type { Metadata } from "next";
import { AppShell } from "../app-shell";
import { LiveScoreClient } from "./live-score-client";

export const metadata: Metadata = {
  title: "Live Score | 3x3 Tournament Manager",
  description: "Interaktivni live scoring ekran za 3x3 utakmicu.",
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
    <AppShell activeModule="Live Score">
      <LiveScoreClient
        initialMatchId={initialMatchId}
        key={initialMatchId ?? "live-score"}
      />
    </AppShell>
  );
}
