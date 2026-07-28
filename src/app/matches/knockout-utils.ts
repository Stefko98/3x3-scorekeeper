import {
  getMatchPhase,
  type Match,
  type MatchPhase,
} from "./match-store";

export const knockoutPhaseOrder: MatchPhase[] = [
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "FINAL",
];

export function applyKnockoutProgression(
  matches: Match[],
  finishedMatchId: string,
) {
  const finishedMatch = matches.find((match) => match.id === finishedMatchId);

  if (!finishedMatch || finishedMatch.status !== "FINISHED") {
    return matches;
  }

  const winnerTeamId =
    finishedMatch.winnerTeamId ?? getWinnerTeamId(finishedMatch);
  const phase = getMatchPhase(finishedMatch);

  if (!winnerTeamId || phase === "GROUP_STAGE" || phase === "FINAL") {
    return matches;
  }

  const currentRoundMatches = getPhaseMatches(
    matches,
    finishedMatch.tournamentId,
    phase,
  );
  const currentIndex = currentRoundMatches.findIndex(
    (match) => match.id === finishedMatch.id,
  );

  if (currentIndex < 0) {
    return matches;
  }

  const nextPhase = phase === "QUARTER_FINAL" ? "SEMI_FINAL" : "FINAL";
  const targetIndex = phase === "QUARTER_FINAL" ? Math.floor(currentIndex / 2) : 0;
  const targetSlot = currentIndex % 2 === 0 ? "teamAId" : "teamBId";
  const nextMatches = ensureTargetMatches(
    matches,
    finishedMatch,
    nextPhase,
    targetIndex,
  );
  const targetMatches = getPhaseMatches(
    nextMatches,
    finishedMatch.tournamentId,
    nextPhase,
  );
  const targetMatch = targetMatches[targetIndex];

  if (!targetMatch) {
    return nextMatches;
  }

  return nextMatches.map((match) =>
    match.id === targetMatch.id
      ? {
          ...match,
          [targetSlot]: winnerTeamId,
          updatedAt: new Date().toISOString(),
        }
      : match,
  );
}

export function canSafelyReopenMatch(matches: Match[], matchId: string) {
  const match = matches.find((item) => item.id === matchId);

  if (!match || match.status !== "FINISHED") {
    return false;
  }

  const phase = getMatchPhase(match);

  if (phase === "FINAL") {
    return true;
  }

  if (phase === "GROUP_STAGE") {
    return matches
      .filter(
        (item) =>
          item.tournamentId === match.tournamentId &&
          getMatchPhase(item) !== "GROUP_STAGE",
      )
      .every((item) => item.status === "SCHEDULED");
  }

  const targetMatch = getProgressionTargetMatch(matches, match);

  return !targetMatch || targetMatch.status === "SCHEDULED";
}

export function rollbackKnockoutProgression(
  matches: Match[],
  reopenedMatchId: string,
) {
  const reopenedMatch = matches.find((match) => match.id === reopenedMatchId);

  if (!reopenedMatch) {
    return matches;
  }

  const phase = getMatchPhase(reopenedMatch);

  if (phase === "GROUP_STAGE" || phase === "FINAL") {
    return matches;
  }

  const target = getProgressionTarget(matches, reopenedMatch);

  if (!target?.match || target.match.status !== "SCHEDULED") {
    return matches;
  }

  const previousWinner =
    reopenedMatch.winnerTeamId ?? getWinnerTeamId(reopenedMatch);

  if (!previousWinner || target.match[target.slot] !== previousWinner) {
    return matches;
  }

  return matches.map((match) =>
    match.id === target.match?.id
      ? {
          ...match,
          [target.slot]: "",
          updatedAt: new Date().toISOString(),
        }
      : match,
  );
}

export function getPhaseMatches(
  matches: Match[],
  tournamentId: string,
  phase: MatchPhase,
) {
  return matches
    .filter(
      (match) =>
        match.tournamentId === tournamentId && getMatchPhase(match) === phase,
    )
    .sort(compareMatches);
}

export function getEliminatedTeamIds(matches: Match[], tournamentId: string) {
  const eliminatedTeamIds = new Set<string>();

  for (const match of matches) {
    if (
      match.tournamentId !== tournamentId ||
      match.status !== "FINISHED" ||
      getMatchPhase(match) === "GROUP_STAGE"
    ) {
      continue;
    }

    const winnerTeamId = match.winnerTeamId ?? getWinnerTeamId(match);

    if (!winnerTeamId) {
      continue;
    }

    if (match.teamAId && match.teamAId !== winnerTeamId) {
      eliminatedTeamIds.add(match.teamAId);
    }

    if (match.teamBId && match.teamBId !== winnerTeamId) {
      eliminatedTeamIds.add(match.teamBId);
    }
  }

  return eliminatedTeamIds;
}

export function getChampionTeamId(matches: Match[], tournamentId: string) {
  const finalMatch = getPhaseMatches(matches, tournamentId, "FINAL").find(
    (match) => match.status === "FINISHED",
  );

  return finalMatch?.winnerTeamId ?? (finalMatch ? getWinnerTeamId(finalMatch) : undefined);
}

function ensureTargetMatches(
  matches: Match[],
  sourceMatch: Match,
  targetPhase: MatchPhase,
  targetIndex: number,
) {
  const targetMatches = getPhaseMatches(
    matches,
    sourceMatch.tournamentId,
    targetPhase,
  );

  if (targetMatches[targetIndex]) {
    return matches;
  }

  const now = new Date().toISOString();
  const createdMatches: Match[] = [];

  for (let index = targetMatches.length; index <= targetIndex; index += 1) {
    createdMatches.push({
      courtName: sourceMatch.courtName,
      createdAt: new Date(Date.now() + index).toISOString(),
      foulsA: 0,
      foulsB: 0,
      id: `auto-knockout:${sourceMatch.tournamentId}:${targetPhase}:${index + 1}`,
      matchPhase: targetPhase,
      scheduledTime: "",
      scoreA: 0,
      scoreB: 0,
      status: "SCHEDULED",
      teamAId: "",
      teamBId: "",
      tournamentId: sourceMatch.tournamentId,
      updatedAt: now,
    });
  }

  return [...matches, ...createdMatches];
}

function getProgressionTargetMatch(matches: Match[], sourceMatch: Match) {
  return getProgressionTarget(matches, sourceMatch)?.match;
}

function getProgressionTarget(matches: Match[], sourceMatch: Match) {
  const phase = getMatchPhase(sourceMatch);

  if (phase !== "QUARTER_FINAL" && phase !== "SEMI_FINAL") {
    return undefined;
  }

  const currentRoundMatches = getPhaseMatches(
    matches,
    sourceMatch.tournamentId,
    phase,
  );
  const currentIndex = currentRoundMatches.findIndex(
    (match) => match.id === sourceMatch.id,
  );

  if (currentIndex < 0) {
    return undefined;
  }

  const nextPhase = phase === "QUARTER_FINAL" ? "SEMI_FINAL" : "FINAL";
  const targetIndex = phase === "QUARTER_FINAL" ? Math.floor(currentIndex / 2) : 0;
  const targetMatches = getPhaseMatches(
    matches,
    sourceMatch.tournamentId,
    nextPhase,
  );

  return {
    match: targetMatches[targetIndex],
    slot: currentIndex % 2 === 0
      ? ("teamAId" as const)
      : ("teamBId" as const),
  };
}

function getWinnerTeamId(match: Match) {
  if (match.scoreA === match.scoreB) {
    return undefined;
  }

  return match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
}

function compareMatches(a: Match, b: Match) {
  return (
    (a.scheduledTime || a.createdAt).localeCompare(b.scheduledTime || b.createdAt) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}
