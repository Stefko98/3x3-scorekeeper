import type { Match } from "../matches/match-store";
import type { Team } from "../teams/team-store";

export type StandingRow = {
  groupName: string;
  losses: number;
  played: number;
  pointDifference: number;
  points: number;
  pointsAgainst: number;
  pointsFor: number;
  rank: number;
  team: Team;
  wins: number;
};

export type StandingGroup = {
  groupName: string;
  rows: StandingRow[];
};

type MutableStandingRow = Omit<StandingRow, "pointDifference" | "rank">;

export function calculateStandings({
  matches,
  teams,
}: {
  matches: Match[];
  teams: Team[];
}): StandingGroup[] {
  const rowsByTeamId = new Map<string, MutableStandingRow>();

  for (const team of teams) {
    rowsByTeamId.set(team.id, {
      groupName: normalizeGroupName(team.groupName),
      losses: 0,
      played: 0,
      points: 0,
      pointsAgainst: 0,
      pointsFor: 0,
      team,
      wins: 0,
    });
  }

  for (const match of matches) {
    if (match.status !== "FINISHED") {
      continue;
    }

    const teamA = rowsByTeamId.get(match.teamAId);
    const teamB = rowsByTeamId.get(match.teamBId);

    if (!teamA || !teamB || match.scoreA === match.scoreB) {
      continue;
    }

    teamA.played += 1;
    teamA.pointsFor += match.scoreA;
    teamA.pointsAgainst += match.scoreB;

    teamB.played += 1;
    teamB.pointsFor += match.scoreB;
    teamB.pointsAgainst += match.scoreA;

    if (match.scoreA > match.scoreB) {
      teamA.wins += 1;
      teamA.points += 2;
      teamB.losses += 1;
      teamB.points += 1;
    } else {
      teamB.wins += 1;
      teamB.points += 2;
      teamA.losses += 1;
      teamA.points += 1;
    }
  }

  const groupedRows = new Map<string, StandingRow[]>();

  for (const row of rowsByTeamId.values()) {
    const standingRow: StandingRow = {
      ...row,
      pointDifference: row.pointsFor - row.pointsAgainst,
      rank: 0,
    };
    const groupRows = groupedRows.get(row.groupName) ?? [];
    groupRows.push(standingRow);
    groupedRows.set(row.groupName, groupRows);
  }

  return [...groupedRows.entries()]
    .map(([groupName, rows]) => ({
      groupName,
      rows: rows.sort(compareStandingRows).map((row, index) => ({
        ...row,
        rank: index + 1,
      })),
    }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
}

function compareStandingRows(a: StandingRow, b: StandingRow) {
  return (
    b.points - a.points ||
    b.wins - a.wins ||
    b.pointDifference - a.pointDifference ||
    b.pointsFor - a.pointsFor ||
    a.team.name.localeCompare(b.team.name)
  );
}

function normalizeGroupName(value: string) {
  const groupName = value.trim();

  return groupName ? `Grupa ${groupName}` : "Bez grupe";
}
