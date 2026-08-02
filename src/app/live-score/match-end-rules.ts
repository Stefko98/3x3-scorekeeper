import type { MatchStatus } from "../matches/match-store";

export type MatchEndDecision = "FINISH" | "OVERTIME";

type ScoreBySide = {
  teamA: number;
  teamB: number;
};

export function getMatchEndDecision({
  matchStatus,
  overtimePointsToWin,
  overtimeScore,
  pointLimit,
  remainingSeconds,
  score,
}: {
  matchStatus: MatchStatus;
  overtimePointsToWin: number;
  overtimeScore?: ScoreBySide;
  pointLimit: number;
  remainingSeconds: number;
  score: ScoreBySide;
}): MatchEndDecision | undefined {
  if (matchStatus !== "LIVE" && matchStatus !== "PAUSED") {
    return undefined;
  }

  if (overtimeScore) {
    return Math.max(overtimeScore.teamA, overtimeScore.teamB) >=
      overtimePointsToWin
      ? "FINISH"
      : undefined;
  }

  if (remainingSeconds === 0) {
    return score.teamA === score.teamB ? "OVERTIME" : "FINISH";
  }

  if (score.teamA !== score.teamB && Math.max(score.teamA, score.teamB) >= pointLimit) {
    return "FINISH";
  }

  return undefined;
}
