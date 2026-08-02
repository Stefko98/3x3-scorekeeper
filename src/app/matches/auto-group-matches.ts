import type { Team } from "../teams/team-store";
import { knockoutPhaseOrder } from "./knockout-utils";
import { getMatchPhase, type Match } from "./match-store";

export type AutoGroupPairing = {
  groupName: string;
  teamA: Team;
  teamB: Team;
};

export type AutoGroupMatchPlan = {
  canCreate: boolean;
  existingGroupMatches: number;
  groups: Array<{
    groupName: string;
    missingMatches: number;
    teamCount: number;
  }>;
  message: string;
  pairings: AutoGroupPairing[];
};

export type GroupMatchSection = {
  groupName: string;
  matches: Match[];
};

export function buildAutomaticGroupMatchPlan({
  matches,
  teams,
  tournamentId,
}: {
  matches: Match[];
  teams: Team[];
  tournamentId: string;
}): AutoGroupMatchPlan {
  const tournamentTeams = teams.filter(
    (team) => team.tournamentId === tournamentId,
  );
  const tournamentGroupMatches = matches.filter(
    (match) =>
      match.tournamentId === tournamentId &&
      getMatchPhase(match) === "GROUP_STAGE",
  );
  const unassignedTeams = tournamentTeams.filter(
    (team) => !team.groupName.trim(),
  );
  const existingPairKeys = new Set(
    tournamentGroupMatches.map((match) =>
      getPairKey(match.teamAId, match.teamBId),
    ),
  );
  const teamsByGroup = groupTeams(tournamentTeams);
  const pairings = [...teamsByGroup.entries()].flatMap(
    ([groupName, groupTeamsForGroup]) =>
      buildPairingsForGroup(groupName, groupTeamsForGroup).filter(
        (pairing) =>
          !existingPairKeys.has(getPairKey(pairing.teamA.id, pairing.teamB.id)),
      ),
  );
  const groups = [...teamsByGroup.entries()].map(
    ([groupName, groupTeamsForGroup]) => ({
      groupName,
      missingMatches: buildPairingsForGroup(
        groupName,
        groupTeamsForGroup,
      ).filter(
        (pairing) =>
          !existingPairKeys.has(getPairKey(pairing.teamA.id, pairing.teamB.id)),
      ).length,
      teamCount: groupTeamsForGroup.length,
    }),
  );

  if (unassignedTeams.length > 0) {
    return {
      canCreate: false,
      existingGroupMatches: tournamentGroupMatches.length,
      groups,
      message: "Prvo rasporedite ekipe po grupama.",
      pairings: [],
    };
  }

  if (tournamentTeams.length < 2) {
    return {
      canCreate: false,
      existingGroupMatches: tournamentGroupMatches.length,
      groups,
      message: "Dodaj bar dve ekipe.",
      pairings,
    };
  }

  if (!groups.some((group) => group.teamCount >= 2)) {
    return {
      canCreate: false,
      existingGroupMatches: tournamentGroupMatches.length,
      groups,
      message: "Nema grupe sa najmanje dve ekipe.",
      pairings,
    };
  }

  if (pairings.length === 0) {
    return {
      canCreate: false,
      existingGroupMatches: tournamentGroupMatches.length,
      groups,
      message: "Sve grupne utakmice su već napravljene.",
      pairings,
    };
  }

  return {
    canCreate: true,
    existingGroupMatches: tournamentGroupMatches.length,
    groups,
    message: `Spremno za ${pairings.length} grupnih utakmica.`,
    pairings,
  };
}

export function getGroupMatchSections(
  matches: Match[],
  teams: Team[],
): GroupMatchSection[] {
  const tournamentIds = new Set(matches.map((match) => match.tournamentId));
  const relevantTeams = teams.filter((team) =>
    tournamentIds.has(team.tournamentId),
  );
  const teamById = new Map(relevantTeams.map((team) => [team.id, team]));
  const matchesByGroup = new Map<string, Match[]>();

  for (const match of matches) {
    const groupName = getMatchGroupName(match, teamById);
    matchesByGroup.set(groupName, [
      ...(matchesByGroup.get(groupName) ?? []),
      match,
    ]);
  }

  return [...matchesByGroup.entries()]
    .map(([groupName, groupMatches]) => {
      const groupTeams = relevantTeams
        .filter((team) => normalizeGroupName(team.groupName) === groupName)
        .sort((teamA, teamB) => teamA.name.localeCompare(teamB.name));
      const scheduledPairings = buildPairingsForGroup(groupName, groupTeams);
      const scheduleIndexByPair = new Map(
        scheduledPairings.map((pairing, index) => [
          getPairKey(pairing.teamA.id, pairing.teamB.id),
          index,
        ]),
      );

      return {
        groupName,
        matches: [...groupMatches].sort(
          (matchA, matchB) =>
            (scheduleIndexByPair.get(
              getPairKey(matchA.teamAId, matchA.teamBId),
            ) ?? Number.MAX_SAFE_INTEGER) -
              (scheduleIndexByPair.get(
                getPairKey(matchB.teamAId, matchB.teamBId),
              ) ?? Number.MAX_SAFE_INTEGER) ||
            matchA.createdAt.localeCompare(matchB.createdAt) ||
            matchA.id.localeCompare(matchB.id),
        ),
      };
    })
    .sort((groupA, groupB) =>
      groupA.groupName.localeCompare(groupB.groupName),
    );
}

export function orderMatchesForSchedule(matches: Match[], teams: Team[]) {
  const groupMatches = matches.filter(
    (match) => getMatchPhase(match) === "GROUP_STAGE",
  );
  const otherMatches = matches.filter(
    (match) => getMatchPhase(match) !== "GROUP_STAGE",
  );

  return [
    ...getGroupMatchSections(groupMatches, teams).flatMap(
      (section) => section.matches,
    ),
    ...otherMatches.sort((matchA, matchB) => {
      const phaseDifference =
        knockoutPhaseOrder.indexOf(getMatchPhase(matchA)) -
        knockoutPhaseOrder.indexOf(getMatchPhase(matchB));

      return (
        phaseDifference ||
        (matchA.scheduledTime || matchA.createdAt).localeCompare(
          matchB.scheduledTime || matchB.createdAt,
        ) ||
        matchA.id.localeCompare(matchB.id)
      );
    }),
  ];
}

export function getAutomaticGroupMatchId(
  tournamentId: string,
  teamAId: string,
  teamBId: string,
) {
  return `auto-group:${tournamentId}:${getPairKey(teamAId, teamBId)}`;
}

function groupTeams(teams: Team[]): Map<string, Team[]> {
  const groups = new Map<string, Team[]>();

  for (const team of teams) {
    if (!team.groupName.trim()) {
      continue;
    }

    const groupName = normalizeGroupName(team.groupName);
    groups.set(groupName, [...(groups.get(groupName) ?? []), team]);
  }

  const sortedEntries: Array<[string, Team[]]> = [...groups.entries()]
    .map(
      ([groupName, groupTeamsForGroup]): [string, Team[]] => [
        groupName,
        groupTeamsForGroup.sort((teamA, teamB) =>
          teamA.name.localeCompare(teamB.name),
        ),
      ],
    )
    .sort(([groupA], [groupB]) => groupA.localeCompare(groupB));

  return new Map<string, Team[]>(sortedEntries);
}

function buildPairingsForGroup(groupName: string, teams: Team[]) {
  if (teams.length < 2) {
    return [];
  }

  const rotation: Array<Team | undefined> =
    teams.length % 2 === 0 ? [...teams] : [...teams, undefined];
  const rounds: AutoGroupPairing[][] = [];

  for (let roundIndex = 0; roundIndex < rotation.length - 1; roundIndex += 1) {
    const round: AutoGroupPairing[] = [];

    for (
      let pairingIndex = 0;
      pairingIndex < rotation.length / 2;
      pairingIndex += 1
    ) {
      const teamA = rotation[pairingIndex];
      const teamB = rotation[rotation.length - 1 - pairingIndex];

      if (teamA && teamB) {
        round.push({ groupName, teamA, teamB });
      }
    }

    rounds.push(round);
    rotation.splice(1, 0, rotation.pop());
  }

  const roundRobinOrder = orderRoundsWithRest(rounds).flat();

  return findRestedMatchOrder(roundRobinOrder) ?? roundRobinOrder;
}

function getPairKey(teamAId: string, teamBId: string) {
  return [teamAId, teamBId].sort().join(":");
}

function orderRoundsWithRest(rounds: AutoGroupPairing[][]) {
  const orderedRounds: AutoGroupPairing[][] = [];
  let previousMatch: AutoGroupPairing | undefined;

  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
    const orderedRound = orderRoundForRest(
      rounds[roundIndex],
      previousMatch,
      rounds[roundIndex + 1] ?? [],
    );
    orderedRounds.push(orderedRound);
    previousMatch = orderedRound[orderedRound.length - 1];
  }

  return orderedRounds;
}

function orderRoundForRest(
  round: AutoGroupPairing[],
  previousMatch: AutoGroupPairing | undefined,
  nextRound: AutoGroupPairing[],
) {
  if (round.length < 2) {
    return round;
  }

  let bestOrder = round;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let firstIndex = 0; firstIndex < round.length; firstIndex += 1) {
    for (let lastIndex = 0; lastIndex < round.length; lastIndex += 1) {
      if (firstIndex === lastIndex) {
        continue;
      }

      const firstMatch = round[firstIndex];
      const lastMatch = round[lastIndex];
      const previousConflict =
        previousMatch && matchesShareTeam(previousMatch, firstMatch) ? 100 : 0;
      const nextConflict =
        nextRound.length > 0 &&
        !nextRound.some(
          (nextMatch) => !matchesShareTeam(lastMatch, nextMatch),
        )
          ? 10
          : 0;
      const score = previousConflict + nextConflict;

      if (score < bestScore) {
        bestScore = score;
        bestOrder = [
          firstMatch,
          ...round.filter(
            (_, index) => index !== firstIndex && index !== lastIndex,
          ),
          lastMatch,
        ];
      }
    }
  }

  return bestOrder;
}

function matchesShareTeam(
  matchA: AutoGroupPairing,
  matchB: AutoGroupPairing,
) {
  return (
    matchA.teamA.id === matchB.teamA.id ||
    matchA.teamA.id === matchB.teamB.id ||
    matchA.teamB.id === matchB.teamA.id ||
    matchA.teamB.id === matchB.teamB.id
  );
}

function findRestedMatchOrder(pairings: AutoGroupPairing[]) {
  if (pairings.length < 2) {
    return pairings;
  }

  const compatiblePairings = pairings.map((pairing, pairingIndex) =>
    pairings
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(
        ({ candidate, candidateIndex }) =>
          candidateIndex !== pairingIndex &&
          !matchesShareTeam(pairing, candidate),
      )
      .map(({ candidateIndex }) => candidateIndex),
  );
  const startIndexes = pairings
    .map((_, index) => index)
    .sort(
      (indexA, indexB) =>
        compatiblePairings[indexA].length -
          compatiblePairings[indexB].length || indexA - indexB,
    );
  let searchSteps = 0;
  const maxSearchSteps = 100_000;

  for (const startIndex of startIndexes) {
    const used = new Set([startIndex]);
    const path = [startIndex];

    if (visitPairing(startIndex, used, path)) {
      return path.map((index) => pairings[index]);
    }
  }

  return undefined;

  function visitPairing(
    currentIndex: number,
    used: Set<number>,
    path: number[],
  ): boolean {
    searchSteps += 1;

    if (path.length === pairings.length) {
      return true;
    }

    if (searchSteps > maxSearchSteps) {
      return false;
    }

    const candidates = compatiblePairings[currentIndex]
      .filter((candidateIndex) => !used.has(candidateIndex))
      .sort(
        (indexA, indexB) =>
          countAvailableNeighbors(indexA, used) -
            countAvailableNeighbors(indexB, used) ||
          indexA - indexB,
      );

    for (const candidateIndex of candidates) {
      used.add(candidateIndex);
      path.push(candidateIndex);

      if (visitPairing(candidateIndex, used, path)) {
        return true;
      }

      path.pop();
      used.delete(candidateIndex);
    }

    return false;
  }

  function countAvailableNeighbors(index: number, used: Set<number>) {
    return compatiblePairings[index].filter(
      (candidateIndex) => !used.has(candidateIndex),
    ).length;
  }
}

function getMatchGroupName(match: Match, teamById: Map<string, Team>) {
  const teamA = teamById.get(match.teamAId);
  const teamB = teamById.get(match.teamBId);
  const groupName =
    teamA?.groupName.trim() &&
    teamA.groupName.trim() === teamB?.groupName.trim()
      ? teamA.groupName
      : teamA?.groupName || teamB?.groupName || "";

  return groupName ? normalizeGroupName(groupName) : "Bez grupe";
}

function normalizeGroupName(value: string) {
  const groupName = value.trim();

  return groupName ? `Grupa ${groupName}` : "Bez grupe";
}
