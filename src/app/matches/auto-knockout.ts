import {
  calculateStandings,
  type StandingRow,
} from "../standings/standings-calculator";
import type { Team } from "../teams/team-store";
import {
  getTournamentFormat,
  type TournamentFormatSettings,
} from "../tournaments/tournament-format";
import type { Tournament } from "../tournaments/tournament-store";
import {
  getMatchPhase,
  type Match,
  type MatchPhase,
} from "./match-store";

export type AutoKnockoutPairing = {
  phase: MatchPhase;
  seedA: number;
  seedB: number;
  teamA: Team;
  teamB: Team;
};

export type AutoKnockoutPlan = {
  bracketSize: number;
  canCreate: boolean;
  canReplace: boolean;
  existingKnockoutMatches: number;
  lockedKnockoutMatches: number;
  groupMatches: number;
  message: string;
  pairings: AutoKnockoutPairing[];
  phase?: MatchPhase;
  qualifiedTeams: Team[];
  unfinishedGroupMatches: number;
};

type QualifiedTeam = {
  groupIndex: number;
  row: StandingRow;
  seed: number;
};

export function buildAutomaticKnockoutPlan({
  matches,
  teams,
  tournament,
  tournamentId,
}: {
  matches: Match[];
  teams: Team[];
  tournament?: Tournament;
  tournamentId: string;
}): AutoKnockoutPlan {
  const tournamentMatches = matches.filter(
    (match) => match.tournamentId === tournamentId,
  );
  const groupMatches = tournamentMatches.filter(
    (match) => getMatchPhase(match) === "GROUP_STAGE",
  );
  const unfinishedGroupMatches = groupMatches.filter(
    (match) => match.status !== "FINISHED" && match.status !== "CANCELLED",
  );
  const existingKnockoutMatches = tournamentMatches.filter(
    (match) => getMatchPhase(match) !== "GROUP_STAGE",
  );
  const lockedKnockoutMatches = existingKnockoutMatches.filter(
    (match) =>
      match.status === "FINISHED" ||
      match.status === "LIVE" ||
      match.status === "PAUSED",
  );
  const basePlan = {
    bracketSize: 0,
    canReplace: false,
    existingKnockoutMatches: existingKnockoutMatches.length,
    groupMatches: groupMatches.length,
    lockedKnockoutMatches: lockedKnockoutMatches.length,
    pairings: [],
    qualifiedTeams: [],
    unfinishedGroupMatches: unfinishedGroupMatches.length,
  };

  if (teams.some((team) => !team.groupName.trim())) {
    return {
      ...basePlan,
      canCreate: false,
      message: "Prvo rasporedite ekipe po grupama.",
    };
  }

  if (groupMatches.length === 0) {
    return {
      ...basePlan,
      canCreate: false,
      message: "Prvo napravi utakmice grupne faze.",
    };
  }

  if (unfinishedGroupMatches.length > 0) {
    return {
      ...basePlan,
      canCreate: false,
      message: "Završi sve utakmice grupne faze.",
    };
  }

  const standings = calculateStandings({
    matches: groupMatches,
    teams,
  });
  const format = getTournamentFormat(tournament, teams.length);
  const qualifiedRows = selectQualifiedRows(standings, teams.length, format);
  const bracketSize =
    qualifiedRows.length >= format.knockoutTeams
      ? format.knockoutTeams
      : getBracketSize(qualifiedRows.length);

  if (bracketSize < 2 || bracketSize < format.knockoutTeams) {
    return {
      ...basePlan,
      canCreate: false,
      message: `Nema dovoljno ekipa za knockout format od ${format.knockoutTeams} ekipa.`,
      bracketSize,
      qualifiedTeams: qualifiedRows.map((qualified) => qualified.row.team),
    };
  }

  const selectedQualifiedRows = qualifiedRows.slice(0, bracketSize);
  const pairings = createPairings(selectedQualifiedRows, bracketSize);
  const phase = getOpeningPhase(bracketSize);
  const readyMessage =
    bracketSize === 8
      ? "Spremno za četvrtfinale."
      : bracketSize === 4
        ? "Spremno za polufinale."
        : "Spremno za finale.";

  if (existingKnockoutMatches.length > 0) {
    return {
      ...basePlan,
      canCreate: false,
      canReplace: lockedKnockoutMatches.length === 0 && pairings.length > 0,
      bracketSize,
      message:
        lockedKnockoutMatches.length > 0
          ? "Knockout već ima zapocete ili završene utakmice."
          : "Knockout već postoji. Mozes da ga zamenis pravilnim rasporedom.",
      pairings,
      phase,
      qualifiedTeams: selectedQualifiedRows.map((qualified) => qualified.row.team),
    };
  }

  return {
    ...basePlan,
    bracketSize,
    canCreate: pairings.length > 0,
    message: `${readyMessage} Stablo će se napraviti automatski.`,
    pairings,
    phase,
    qualifiedTeams: selectedQualifiedRows.map((qualified) => qualified.row.team),
  };
}

export function ensureAutomaticKnockout({
  matches,
  teams,
  tournament,
  tournamentId,
}: {
  matches: Match[];
  teams: Team[];
  tournament?: Tournament;
  tournamentId: string;
}) {
  const plan = buildAutomaticKnockoutPlan({
    matches,
    teams: teams.filter((team) => team.tournamentId === tournamentId),
    tournament,
    tournamentId,
  });

  if (!plan.canCreate) {
    if (
      plan.canReplace &&
      shouldReplaceExistingKnockout(matches, tournamentId, plan)
    ) {
      return [
        ...matches.filter(
          (match) =>
            match.tournamentId !== tournamentId ||
            getMatchPhase(match) === "GROUP_STAGE",
        ),
        ...buildKnockoutMatchesFromPlan(plan, tournamentId),
      ];
    }

    return matches;
  }

  return [...matches, ...buildKnockoutMatchesFromPlan(plan, tournamentId)];
}

export function buildKnockoutMatchesFromPlan(
  plan: AutoKnockoutPlan,
  tournamentId: string,
): Match[] {
  const matchSpecs = [
    ...plan.pairings.map((pairing) => ({
      phase: pairing.phase,
      teamAId: pairing.teamA.id,
      teamBId: pairing.teamB.id,
    })),
    ...createEmptyProgressionSpecs(plan.bracketSize),
  ];
  const now = new Date().toISOString();
  const phaseIndexes = new Map<MatchPhase, number>();

  return matchSpecs.map((spec, index): Match => {
    const phaseIndex = (phaseIndexes.get(spec.phase) ?? 0) + 1;
    phaseIndexes.set(spec.phase, phaseIndex);

    return {
      courtName: "Kos 1",
      createdAt: new Date(Date.now() + index).toISOString(),
      foulsA: 0,
      foulsB: 0,
      id: `auto-knockout:${tournamentId}:${spec.phase}:${phaseIndex}`,
      matchPhase: spec.phase,
      scheduledTime: "",
      scoreA: 0,
      scoreB: 0,
      status: "SCHEDULED",
      teamAId: spec.teamAId,
      teamBId: spec.teamBId,
      tournamentId,
      updatedAt: now,
    };
  });
}

function createEmptyProgressionSpecs(bracketSize: number) {
  if (bracketSize === 8) {
    return [
      { phase: "SEMI_FINAL" as MatchPhase, teamAId: "", teamBId: "" },
      { phase: "SEMI_FINAL" as MatchPhase, teamAId: "", teamBId: "" },
      { phase: "THIRD_PLACE" as MatchPhase, teamAId: "", teamBId: "" },
      { phase: "FINAL" as MatchPhase, teamAId: "", teamBId: "" },
    ];
  }

  if (bracketSize === 4) {
    return [
      { phase: "THIRD_PLACE" as MatchPhase, teamAId: "", teamBId: "" },
      { phase: "FINAL" as MatchPhase, teamAId: "", teamBId: "" },
    ];
  }

  return [];
}

function selectQualifiedRows(
  standings: ReturnType<typeof calculateStandings>,
  teamCount: number,
  format: TournamentFormatSettings,
): QualifiedTeam[] {
  const activeGroups = standings.filter((group) =>
    group.rows.some((row) => row.played > 0),
  );

  if (activeGroups.length === 0) {
    return [];
  }

  const customQualifiedRows = selectQualifiedRowsByFormat(activeGroups, format);

  if (customQualifiedRows.length > 0) {
    return customQualifiedRows;
  }

  if (teamCount === 8 && activeGroups.length >= 2) {
    return activeGroups.slice(0, 2).flatMap((group, groupIndex) =>
      group.rows.slice(0, 2).map((row, index) => ({
        groupIndex,
        row,
        seed: index + 1,
      })),
    );
  }

  if (teamCount === 8) {
    return activeGroups.flatMap((group, groupIndex) =>
      group.rows.map((row, index) => ({
        groupIndex,
        row,
        seed: index + 1,
      })),
    ).slice(0, 4);
  }

  if (teamCount === 10 && activeGroups.length >= 2) {
    return activeGroups.slice(0, 2).flatMap((group, groupIndex) =>
      group.rows.slice(0, 4).map((row, index) => ({
        groupIndex,
        row,
        seed: index + 1,
      })),
    );
  }

  if (teamCount === 12 && activeGroups.length >= 4) {
    return activeGroups.slice(0, 4).flatMap((group, groupIndex) =>
      group.rows.slice(0, 2).map((row, index) => ({
        groupIndex,
        row,
        seed: index + 1,
      })),
    );
  }

  if (
    activeGroups.length === 2 &&
    activeGroups.every((group) => group.rows.length >= 5)
  ) {
    return activeGroups.flatMap((group, groupIndex) =>
      group.rows.slice(0, 4).map((row, index) => ({
        groupIndex,
        row,
        seed: index + 1,
      })),
    );
  }

  if (activeGroups.length >= 4) {
    return activeGroups.slice(0, 4).flatMap((group, groupIndex) =>
      group.rows.slice(0, 2).map((row, index) => ({
        groupIndex,
        row,
        seed: index + 1,
      })),
    );
  }

  if (activeGroups.length >= 2) {
    return activeGroups.flatMap((group, groupIndex) =>
      group.rows.slice(0, 2).map((row, index) => ({
        groupIndex,
        row,
        seed: index + 1,
      })),
    );
  }

  return activeGroups[0].rows.slice(0, 8).map((row, index) => ({
    groupIndex: 0,
    row,
    seed: index + 1,
  }));
}

function selectQualifiedRowsByFormat(
  activeGroups: ReturnType<typeof calculateStandings>,
  format: TournamentFormatSettings,
): QualifiedTeam[] {
  const groupCount = getEffectiveGroupCount(activeGroups, format);

  if (groupCount <= 0) {
    return [];
  }

  const basePerGroup = Math.floor(format.knockoutTeams / groupCount);
  const extraTeams = format.knockoutTeams % groupCount;

  return activeGroups.slice(0, groupCount).flatMap((group, groupIndex) => {
    const limit = basePerGroup + (groupIndex < extraTeams ? 1 : 0);

    return group.rows.slice(0, limit).map((row, index) => ({
      groupIndex,
      row,
      seed: index + 1,
    }));
  });
}

function getEffectiveGroupCount(
  activeGroups: ReturnType<typeof calculateStandings>,
  format: TournamentFormatSettings,
) {
  if (
    activeGroups.length > format.groupCount &&
    format.knockoutTeams >= activeGroups.length
  ) {
    return activeGroups.length;
  }

  return Math.min(format.groupCount, activeGroups.length);
}

function getBracketSize(qualifiedCount: number) {
  if (qualifiedCount >= 8) {
    return 8;
  }

  if (qualifiedCount >= 4) {
    return 4;
  }

  if (qualifiedCount >= 2) {
    return 2;
  }

  return 0;
}

function seedQualifiedTeams(
  qualifiedRows: QualifiedTeam[],
  bracketSize: number,
) {
  const selectedRows = qualifiedRows.slice(0, bracketSize);

  if (bracketSize === 8) {
    const twoGroups = getRowsByGroup(selectedRows, 2);

    if (twoGroups?.every((groupRows) => groupRows.length >= 4)) {
      return [
        twoGroups[0][0],
        twoGroups[1][0],
        twoGroups[0][1],
        twoGroups[1][1],
        twoGroups[0][2],
        twoGroups[1][2],
        twoGroups[0][3],
        twoGroups[1][3],
      ];
    }

    const fourGroups = getRowsByGroup(selectedRows, 4);

    if (fourGroups?.every((groupRows) => groupRows.length >= 2)) {
      return [
        fourGroups[0][0],
        fourGroups[1][0],
        fourGroups[2][0],
        fourGroups[3][0],
        fourGroups[0][1],
        fourGroups[1][1],
        fourGroups[2][1],
        fourGroups[3][1],
      ];
    }
  }

  if (bracketSize === 4) {
    const twoGroups = getRowsByGroup(selectedRows, 2);

    if (twoGroups?.every((groupRows) => groupRows.length >= 2)) {
      return [
        twoGroups[0][0],
        twoGroups[1][0],
        twoGroups[0][1],
        twoGroups[1][1],
      ];
    }
  }

  return [...selectedRows].sort(compareQualifiedRows);
}

function createPairings(
  qualifiedRows: QualifiedTeam[],
  bracketSize: number,
): AutoKnockoutPairing[] {
  const structuredPairings = createStructuredPairings(
    qualifiedRows,
    bracketSize,
  );
  const pairedRows =
    structuredPairings ??
    createSeedPairings(seedQualifiedTeams(qualifiedRows, bracketSize), bracketSize);
  const phase = getOpeningPhase(bracketSize);

  return pairedRows.map(([teamA, teamB], index) => ({
    phase,
    seedA: index + 1,
    seedB: index + 1,
    teamA: teamA.row.team,
    teamB: teamB.row.team,
  }));
}

function createSeedPairings(
  seededTeams: QualifiedTeam[],
  bracketSize: number,
): Array<[QualifiedTeam, QualifiedTeam]> {
  const indexesBySize: Record<number, Array<[number, number]>> = {
    2: [[0, 1]],
    4: [
      [0, 3],
      [1, 2],
    ],
    8: [
      [0, 7],
      [3, 4],
      [1, 6],
      [2, 5],
    ],
  };

  return indexesBySize[bracketSize].map(([indexA, indexB]) => [
    seededTeams[indexA],
    seededTeams[indexB],
  ]);
}

function createStructuredPairings(
  qualifiedRows: QualifiedTeam[],
  bracketSize: number,
): Array<[QualifiedTeam, QualifiedTeam]> | undefined {
  if (bracketSize === 8) {
    const fourGroups = getRowsByGroup(qualifiedRows, 4);

    if (fourGroups?.every((groupRows) => groupRows.length >= 2)) {
      return [
        [fourGroups[0][0], fourGroups[2][1]],
        [fourGroups[2][0], fourGroups[0][1]],
        [fourGroups[1][0], fourGroups[3][1]],
        [fourGroups[3][0], fourGroups[1][1]],
      ];
    }

    const twoGroups = getRowsByGroup(qualifiedRows, 2);

    if (twoGroups?.every((groupRows) => groupRows.length >= 4)) {
      return [
        [twoGroups[0][0], twoGroups[1][3]],
        [twoGroups[1][0], twoGroups[0][3]],
        [twoGroups[0][1], twoGroups[1][2]],
        [twoGroups[1][1], twoGroups[0][2]],
      ];
    }
  }

  if (bracketSize === 4) {
    const twoGroups = getRowsByGroup(qualifiedRows, 2);

    if (twoGroups?.every((groupRows) => groupRows.length >= 2)) {
      return [
        [twoGroups[0][0], twoGroups[1][1]],
        [twoGroups[1][0], twoGroups[0][1]],
      ];
    }

    const fourGroups = getRowsByGroup(qualifiedRows, 4);

    if (fourGroups?.every((groupRows) => groupRows.length >= 1)) {
      return [
        [fourGroups[0][0], fourGroups[2][0]],
        [fourGroups[1][0], fourGroups[3][0]],
      ];
    }
  }

  return undefined;
}

function shouldReplaceExistingKnockout(
  matches: Match[],
  tournamentId: string,
  plan: AutoKnockoutPlan,
) {
  if (plan.lockedKnockoutMatches > 0 || plan.pairings.length === 0) {
    return false;
  }

  const existingKnockoutMatches = matches.filter(
    (match) =>
      match.tournamentId === tournamentId &&
      getMatchPhase(match) !== "GROUP_STAGE",
  );
  const expectedKnockoutMatches =
    plan.pairings.length + createEmptyProgressionSpecs(plan.bracketSize).length;

  if (existingKnockoutMatches.length !== expectedKnockoutMatches) {
    return true;
  }

  const openingPhase = getOpeningPhase(plan.bracketSize);
  const openingMatches = existingKnockoutMatches
    .filter((match) => getMatchPhase(match) === openingPhase)
    .sort(compareMatches);

  if (openingMatches.length !== plan.pairings.length) {
    return true;
  }

  return openingMatches.some((match, index) => {
    const pairing = plan.pairings[index];

    return (
      match.teamAId !== pairing.teamA.id ||
      match.teamBId !== pairing.teamB.id
    );
  });
}

function getOpeningPhase(bracketSize: number): MatchPhase {
  if (bracketSize === 8) {
    return "QUARTER_FINAL";
  }

  if (bracketSize === 4) {
    return "SEMI_FINAL";
  }

  return "FINAL";
}

function getRowsByGroup(rows: QualifiedTeam[], groupCount: number) {
  const grouped = new Map<number, QualifiedTeam[]>();

  for (const row of rows) {
    grouped.set(row.groupIndex, [...(grouped.get(row.groupIndex) ?? []), row]);
  }

  if (grouped.size !== groupCount) {
    return undefined;
  }

  return [...grouped.entries()]
    .sort(([groupA], [groupB]) => groupA - groupB)
    .map(([, groupRows]) =>
      groupRows.sort((rowA, rowB) => rowA.seed - rowB.seed),
    );
}

function compareQualifiedRows(a: QualifiedTeam, b: QualifiedTeam) {
  return (
    b.row.points - a.row.points ||
    b.row.wins - a.row.wins ||
    b.row.pointDifference - a.row.pointDifference ||
    b.row.pointsFor - a.row.pointsFor ||
    a.row.team.name.localeCompare(b.row.team.name)
  );
}

function compareMatches(a: Match, b: Match) {
  return (
    (a.scheduledTime || a.createdAt).localeCompare(b.scheduledTime || b.createdAt) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}
