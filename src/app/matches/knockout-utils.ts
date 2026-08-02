import {
  getMatchPhase,
  type Match,
  type MatchPhase,
} from "./match-store";

export const knockoutPhaseOrder: MatchPhase[] = [
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "THIRD_PLACE",
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
  const loserTeamId = getLoserTeamId(finishedMatch, winnerTeamId);
  const phase = getMatchPhase(finishedMatch);

  if (
    !winnerTeamId ||
    phase === "GROUP_STAGE" ||
    phase === "THIRD_PLACE" ||
    phase === "FINAL"
  ) {
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

  const targetSlot = currentIndex % 2 === 0 ? "teamAId" : "teamBId";

  if (phase === "QUARTER_FINAL") {
    const targetIndex = Math.floor(currentIndex / 2);
    const nextMatches = ensureTargetMatches(
      matches,
      finishedMatch,
      "SEMI_FINAL",
      targetIndex,
    );
    const targetMatch = getPhaseMatches(
      nextMatches,
      finishedMatch.tournamentId,
      "SEMI_FINAL",
    )[targetIndex];

    return assignTeamToMatch(nextMatches, targetMatch, targetSlot, winnerTeamId);
  }

  if (!loserTeamId) {
    return matches;
  }

  let nextMatches = ensureTargetMatches(
    matches,
    finishedMatch,
    "THIRD_PLACE",
    0,
  );
  nextMatches = ensureTargetMatches(
    nextMatches,
    finishedMatch,
    "FINAL",
    0,
  );
  const thirdPlaceMatch = getPhaseMatches(
    nextMatches,
    finishedMatch.tournamentId,
    "THIRD_PLACE",
  )[0];
  const finalMatch = getPhaseMatches(
    nextMatches,
    finishedMatch.tournamentId,
    "FINAL",
  )[0];

  return nextMatches.map((match) => {
    if (match.id === finalMatch?.id) {
      return {
        ...match,
        [targetSlot]: winnerTeamId,
        updatedAt: new Date().toISOString(),
      };
    }

    if (match.id === thirdPlaceMatch?.id) {
      return {
        ...match,
        [targetSlot]: loserTeamId,
        updatedAt: new Date().toISOString(),
      };
    }

    return match;
  });
}

export function canStartKnockoutMatch(matches: Match[], matchId: string) {
  const match = matches.find((item) => item.id === matchId);

  if (!match) {
    return false;
  }

  const phase = getMatchPhase(match);

  if (phase === "THIRD_PLACE") {
    const semiFinals = getPhaseMatches(
      matches,
      match.tournamentId,
      "SEMI_FINAL",
    );

    return (
      semiFinals.length < 2 ||
      semiFinals.every((semiFinal) => semiFinal.status === "FINISHED")
    );
  }

  if (phase === "FINAL") {
    const thirdPlaceMatch = getPhaseMatches(
      matches,
      match.tournamentId,
      "THIRD_PLACE",
    )[0];

    return (
      !thirdPlaceMatch ||
      thirdPlaceMatch.status === "FINISHED" ||
      thirdPlaceMatch.status === "CANCELLED"
    );
  }

  return true;
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

  if (phase === "THIRD_PLACE") {
    const finalMatch = getPhaseMatches(matches, match.tournamentId, "FINAL")[0];
    return !finalMatch || finalMatch.status === "SCHEDULED";
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

  return getProgressionTargets(matches, match).every(
    (target) => !target.match || target.match.status === "SCHEDULED",
  );
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

  if (
    phase === "GROUP_STAGE" ||
    phase === "THIRD_PLACE" ||
    phase === "FINAL"
  ) {
    return matches;
  }

  const previousWinner =
    reopenedMatch.winnerTeamId ?? getWinnerTeamId(reopenedMatch);
  const previousLoser = getLoserTeamId(reopenedMatch, previousWinner);
  const targets = getProgressionTargets(matches, reopenedMatch);

  if (
    !previousWinner ||
    targets.some(
      (target) => target.match && target.match.status !== "SCHEDULED",
    )
  ) {
    return matches;
  }

  return matches.map((match) => {
    const target = targets.find((item) => item.match?.id === match.id);

    if (!target) {
      return match;
    }

    const previousTeamId =
      target.participant === "WINNER" ? previousWinner : previousLoser;

    if (!previousTeamId || match[target.slot] !== previousTeamId) {
      return match;
    }

    return {
      ...match,
      [target.slot]: "",
      updatedAt: new Date().toISOString(),
    };
  });
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

type ProgressionTarget = {
  match?: Match;
  participant: "LOSER" | "WINNER";
  slot: "teamAId" | "teamBId";
};

function getProgressionTargets(
  matches: Match[],
  sourceMatch: Match,
): ProgressionTarget[] {
  const phase = getMatchPhase(sourceMatch);

  if (phase !== "QUARTER_FINAL" && phase !== "SEMI_FINAL") {
    return [];
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
    return [];
  }

  const slot =
    currentIndex % 2 === 0
      ? ("teamAId" as const)
      : ("teamBId" as const);

  if (phase === "QUARTER_FINAL") {
    return [
      {
        match: getPhaseMatches(
          matches,
          sourceMatch.tournamentId,
          "SEMI_FINAL",
        )[Math.floor(currentIndex / 2)],
        participant: "WINNER",
        slot,
      },
    ];
  }

  return [
    {
      match: getPhaseMatches(matches, sourceMatch.tournamentId, "FINAL")[0],
      participant: "WINNER",
      slot,
    },
    {
      match: getPhaseMatches(
        matches,
        sourceMatch.tournamentId,
        "THIRD_PLACE",
      )[0],
      participant: "LOSER",
      slot,
    },
  ];
}

function assignTeamToMatch(
  matches: Match[],
  targetMatch: Match | undefined,
  targetSlot: "teamAId" | "teamBId",
  teamId: string,
) {
  if (!targetMatch) {
    return matches;
  }

  return matches.map((match) =>
    match.id === targetMatch.id
      ? {
          ...match,
          [targetSlot]: teamId,
          updatedAt: new Date().toISOString(),
        }
      : match,
  );
}

function getWinnerTeamId(match: Match) {
  if (match.scoreA === match.scoreB) {
    return undefined;
  }

  return match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
}

function getLoserTeamId(match: Match, winnerTeamId?: string) {
  if (!winnerTeamId) {
    return undefined;
  }

  return match.teamAId === winnerTeamId ? match.teamBId : match.teamAId;
}

function compareMatches(a: Match, b: Match) {
  return (
    (a.scheduledTime || a.createdAt).localeCompare(b.scheduledTime || b.createdAt) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}
