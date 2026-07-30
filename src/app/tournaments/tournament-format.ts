import type { MatchPhase } from "../matches/match-store";
import type { Tournament } from "./tournament-store";

export type KnockoutTeams = 2 | 4 | 8;

export type TournamentFormatSettings = {
  groupCount: number;
  knockoutTeams: KnockoutTeams;
  openingPhase: MatchPhase;
  qualifiersPerGroupText: string;
};

export function getTournamentFormat(
  tournament: Pick<Tournament, "groupCount" | "knockoutTeams" | "maxTeams"> | undefined,
  teamCount?: number,
): TournamentFormatSettings {
  const referenceTeamCount = teamCount && teamCount > 0
    ? teamCount
    : tournament?.maxTeams ?? 8;
  const recommended = getRecommendedTournamentFormat(referenceTeamCount);
  const groupCount = normalizeGroupCount(tournament?.groupCount, recommended.groupCount);
  const knockoutTeams = normalizeKnockoutTeams(
    tournament?.knockoutTeams,
    recommended.knockoutTeams,
  );

  return {
    groupCount,
    knockoutTeams,
    openingPhase: getOpeningPhase(knockoutTeams),
    qualifiersPerGroupText: getQualifiersPerGroupText(groupCount, knockoutTeams),
  };
}

export function getRecommendedTournamentFormat(teamCount: number) {
  if (teamCount <= 4) {
    return {
      groupCount: 1,
      knockoutTeams: 2 as KnockoutTeams,
    };
  }

  if (teamCount <= 6) {
    return {
      groupCount: 1,
      knockoutTeams: 4 as KnockoutTeams,
    };
  }

  if (teamCount <= 8) {
    return {
      groupCount: 2,
      knockoutTeams: 4 as KnockoutTeams,
    };
  }

  if (teamCount === 12) {
    return {
      groupCount: 4,
      knockoutTeams: 8 as KnockoutTeams,
    };
  }

  return {
    groupCount: teamCount >= 12 ? 4 : 2,
    knockoutTeams: 8 as KnockoutTeams,
  };
}

export function getOpeningPhase(knockoutTeams: KnockoutTeams): MatchPhase {
  if (knockoutTeams === 8) {
    return "QUARTER_FINAL";
  }

  if (knockoutTeams === 4) {
    return "SEMI_FINAL";
  }

  return "FINAL";
}

export function getEnabledMatchPhases(
  format: Pick<TournamentFormatSettings, "openingPhase">,
): MatchPhase[] {
  const knockoutPhases: MatchPhase[] = [
    "QUARTER_FINAL",
    "SEMI_FINAL",
    "FINAL",
  ];
  const openingPhaseIndex = knockoutPhases.indexOf(format.openingPhase);

  return [
    "GROUP_STAGE",
    ...knockoutPhases.slice(Math.max(0, openingPhaseIndex)),
  ];
}

export function normalizeKnockoutTeams(
  value: number | undefined,
  fallback: KnockoutTeams,
): KnockoutTeams {
  if (value === 2 || value === 4 || value === 8) {
    return value;
  }

  return fallback;
}

export function normalizeGroupCount(value: number | undefined, fallback: number) {
  if (Number.isInteger(value) && value && value > 0 && value <= 8) {
    return value;
  }

  return fallback;
}

export function getQualifiersPerGroupText(groupCount: number, knockoutTeams: KnockoutTeams) {
  if (groupCount === 1) {
    return `Prve ${knockoutTeams} ekipe`;
  }

  const base = Math.floor(knockoutTeams / groupCount);
  const extra = knockoutTeams % groupCount;

  if (base <= 0) {
    return "Najbolji ukupno";
  }

  if (extra === 0) {
    return `${base} iz svake grupe`;
  }

  return `${base} iz svake grupe + ${extra} najbolje dodatne ekipe`;
}
