"use client";

import Link from "next/link";
import {
  getChampionTeamId,
  getEliminatedTeamIds,
  getPhaseMatches,
} from "./knockout-utils";
import {
  matchPhaseLabels,
  type Match,
  type MatchPhase,
} from "./match-store";
import type { Team } from "../teams/team-store";

type KnockoutBracketProps = {
  knockoutTeams?: number;
  matches: Match[];
  showMatchLinks?: boolean;
  teams: Team[];
  tournamentId: string;
};

type BracketSlot = {
  index: number;
  match?: Match;
  phase: MatchPhase;
};

type BracketSlots = {
  champion?: Team;
  final: BracketSlot;
  quarterFinals: BracketSlot[];
  semiFinals: BracketSlot[];
  thirdPlace?: BracketSlot;
};

type BracketSize = 2 | 4 | 8;

type BracketLayout = {
  canvasHeight: number;
  canvasWidth: number;
  championPosition: SlotPosition;
  finalPosition: SlotPosition;
  quarterFinalPositions: SlotPosition[];
  semiFinalPositions: SlotPosition[];
  thirdPlacePosition?: SlotPosition;
};

type SlotPosition = {
  x: number;
  y: number;
};

const matchBoxWidth = 190;
const matchBoxHeight = 146;
const championBoxWidth = 174;

const eightTeamLayout: BracketLayout = {
  canvasHeight: 666,
  canvasWidth: 900,
  championPosition: { x: 718, y: 260 },
  finalPosition: { x: 480, y: 260 },
  quarterFinalPositions: [
    { x: 8, y: 8 },
    { x: 8, y: 176 },
    { x: 8, y: 344 },
    { x: 8, y: 512 },
  ],
  semiFinalPositions: [
    { x: 244, y: 92 },
    { x: 244, y: 428 },
  ],
  thirdPlacePosition: { x: 480, y: 512 },
};

const fourTeamLayout: BracketLayout = {
  canvasHeight: 498,
  canvasWidth: 660,
  championPosition: { x: 478, y: 92 },
  finalPosition: { x: 244, y: 92 },
  quarterFinalPositions: [],
  semiFinalPositions: [
    { x: 8, y: 8 },
    { x: 8, y: 176 },
  ],
  thirdPlacePosition: { x: 244, y: 344 },
};

const twoTeamLayout: BracketLayout = {
  canvasHeight: 162,
  canvasWidth: 430,
  championPosition: { x: 244, y: 8 },
  finalPosition: { x: 8, y: 8 },
  quarterFinalPositions: [],
  semiFinalPositions: [],
};

export function KnockoutBracket({
  knockoutTeams,
  matches,
  showMatchLinks = true,
  teams,
  tournamentId,
}: KnockoutBracketProps) {
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const eliminatedTeamIds = getEliminatedTeamIds(matches, tournamentId);
  const bracketSize = getDisplayBracketSize(
    matches,
    tournamentId,
    teams.length,
    knockoutTeams,
  );
  const layout =
    bracketSize === 8
      ? eightTeamLayout
      : bracketSize === 4
        ? fourTeamLayout
        : twoTeamLayout;
  const slots = buildBracketSlots(matches, tournamentId, teamMap, bracketSize);

  return (
    <section className="min-w-0 rounded-lg border border-white/10 bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] sm:p-5">
      <div>
        <h3 className="text-xl font-bold tracking-normal">
          Knockout stablo
        </h3>
      </div>

      <div className="app-scrollbar mt-5 max-w-full overflow-x-auto overflow-y-hidden rounded-lg border border-white/10 bg-[#0F172A] p-2 lg:p-3">
        <div
          className="relative mx-auto"
          style={{
            height: layout.canvasHeight,
            minWidth: layout.canvasWidth,
            width: layout.canvasWidth,
          }}
        >
          <BracketLines layout={layout} />

          {slots.quarterFinals.map((slot, index) => (
            <MatchSlot
              eliminatedTeamIds={eliminatedTeamIds}
              key={`quarter-${index}`}
              position={layout.quarterFinalPositions[index]}
              showMatchLinks={showMatchLinks}
              slot={slot}
              teamMap={teamMap}
            />
          ))}

          {slots.semiFinals.map((slot, index) => (
            <MatchSlot
              eliminatedTeamIds={eliminatedTeamIds}
              key={`semi-${index}`}
              position={layout.semiFinalPositions[index]}
              showMatchLinks={showMatchLinks}
              slot={slot}
              teamMap={teamMap}
            />
          ))}

          <MatchSlot
            eliminatedTeamIds={eliminatedTeamIds}
            position={layout.finalPosition}
            showMatchLinks={showMatchLinks}
            slot={slots.final}
            teamMap={teamMap}
          />

          {slots.thirdPlace && layout.thirdPlacePosition && (
            <MatchSlot
              eliminatedTeamIds={eliminatedTeamIds}
              position={layout.thirdPlacePosition}
              showMatchLinks={showMatchLinks}
              slot={slots.thirdPlace}
              teamMap={teamMap}
            />
          )}

          <ChampionSlot champion={slots.champion} position={layout.championPosition} />
        </div>
      </div>
    </section>
  );
}

function BracketLines({ layout }: { layout: BracketLayout }) {
  const qCenters = layout.quarterFinalPositions.map(centerY);
  const sCenters = layout.semiFinalPositions.map(centerY);
  const finalCenter = centerY(layout.finalPosition);
  const championCenter = centerY(layout.championPosition);
  const finalLeft = layout.finalPosition.x;
  const finalRight = layout.finalPosition.x + matchBoxWidth;
  const championLeft = layout.championPosition.x;
  const thirdPlaceCenter = layout.thirdPlacePosition
    ? centerY(layout.thirdPlacePosition)
    : undefined;
  const thirdPlaceLeft = layout.thirdPlacePosition?.x;
  const semiPaths =
    layout.semiFinalPositions.length === 2
      ? {
          bridgeX: layout.semiFinalPositions[0].x + matchBoxWidth + 26,
          left: layout.semiFinalPositions[0].x,
          right: layout.semiFinalPositions[0].x + matchBoxWidth,
        }
      : undefined;
  const quarterPaths =
    qCenters.length === 4 && semiPaths
      ? {
          bridgeX: layout.quarterFinalPositions[0].x + matchBoxWidth + 26,
          right: layout.quarterFinalPositions[0].x + matchBoxWidth,
        }
      : undefined;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
      height={layout.canvasHeight}
      viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
      width={layout.canvasWidth}
    >
      <g fill="none" stroke="#38BDF8" strokeLinecap="round" strokeWidth="2.5">
        {quarterPaths && semiPaths && (
          <>
            <BracketPath fromX={quarterPaths.right} fromY={qCenters[0]} toX={semiPaths.left} toY={sCenters[0]} viaX={quarterPaths.bridgeX} />
            <BracketPath fromX={quarterPaths.right} fromY={qCenters[1]} toX={semiPaths.left} toY={sCenters[0]} viaX={quarterPaths.bridgeX} />
            <BracketPath fromX={quarterPaths.right} fromY={qCenters[2]} toX={semiPaths.left} toY={sCenters[1]} viaX={quarterPaths.bridgeX} />
            <BracketPath fromX={quarterPaths.right} fromY={qCenters[3]} toX={semiPaths.left} toY={sCenters[1]} viaX={quarterPaths.bridgeX} />
          </>
        )}
        {semiPaths && (
          <>
            <BracketPath fromX={semiPaths.right} fromY={sCenters[0]} toX={finalLeft} toY={finalCenter} viaX={semiPaths.bridgeX} />
            <BracketPath fromX={semiPaths.right} fromY={sCenters[1]} toX={finalLeft} toY={finalCenter} viaX={semiPaths.bridgeX} />
          </>
        )}
        <path d={`M ${finalRight} ${finalCenter} H ${championLeft}`} />
        <path d={`M ${championLeft - 18} ${championCenter - 34} V ${championCenter + 34}`} opacity="0.45" />
      </g>
      {
        semiPaths &&
        thirdPlaceCenter !== undefined &&
        thirdPlaceLeft !== undefined && (
          <g
            fill="none"
            stroke="#F97316"
            strokeDasharray="7 6"
            strokeLinecap="round"
            strokeWidth="2.5"
          >
            <BracketPath
              fromX={semiPaths.right}
              fromY={sCenters[0]}
              toX={thirdPlaceLeft}
              toY={thirdPlaceCenter}
              viaX={semiPaths.right + 12}
            />
            <BracketPath
              fromX={semiPaths.right}
              fromY={sCenters[1]}
              toX={thirdPlaceLeft}
              toY={thirdPlaceCenter}
              viaX={semiPaths.right + 12}
            />
          </g>
        )
      }
    </svg>
  );
}

function BracketPath({
  fromX,
  fromY,
  toX,
  toY,
  viaX,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  viaX: number;
}) {
  return <path d={`M ${fromX} ${fromY} H ${viaX} V ${toY} H ${toX}`} />;
}

function MatchSlot({
  eliminatedTeamIds,
  position,
  showMatchLinks,
  slot,
  teamMap,
}: {
  eliminatedTeamIds: Set<string>;
  position: SlotPosition;
  showMatchLinks: boolean;
  slot: BracketSlot;
  teamMap: Map<string, Team>;
}) {
  const match = slot.match;
  const winnerTeamId = match?.winnerTeamId ?? (match ? getWinnerTeamId(match) : undefined);
  const matchIsReady =
    Boolean(match?.teamAId) &&
    Boolean(match?.teamBId) &&
    Boolean(match?.teamAId && teamMap.has(match.teamAId)) &&
    Boolean(match?.teamBId && teamMap.has(match.teamBId));
  const isThirdPlaceMatch = slot.phase === "THIRD_PLACE";
  const teamAEliminated = Boolean(
    match?.teamAId &&
      (isThirdPlaceMatch
        ? match.status === "FINISHED" && winnerTeamId !== match.teamAId
        : eliminatedTeamIds.has(match.teamAId)),
  );
  const teamBEliminated = Boolean(
    match?.teamBId &&
      (isThirdPlaceMatch
        ? match.status === "FINISHED" && winnerTeamId !== match.teamBId
        : eliminatedTeamIds.has(match.teamBId)),
  );

  return (
    <article
      className={`absolute z-10 rounded-md border p-2.5 shadow-[0_12px_28px_rgba(2,6,23,0.28)] ${
        match
          ? "border-white/10 bg-[#111827]"
          : "border-dashed border-white/15 bg-[#111827]/70"
      }`}
      style={{
        height: matchBoxHeight,
        left: position.x,
        top: position.y,
        width: matchBoxWidth,
      }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="truncate text-xs font-bold text-[#94A3B8]">
          {matchPhaseLabels[slot.phase]} {slot.index + 1}
        </p>
        {match && showMatchLinks && matchIsReady && (
          <Link
            className="rounded-md border border-white/20 bg-white/[0.05] px-2 py-1 text-xs font-black text-white shadow-sm transition hover:border-[#F97316] hover:bg-[#F97316] hover:text-[#111827]"
            href={`/live-score?matchId=${match.id}`}
          >
            Otvori
          </Link>
        )}
      </div>

      {match ? (
        <div className="grid gap-2">
          <TeamLine
            eliminated={teamAEliminated}
            isThirdPlaceMatch={isThirdPlaceMatch}
            isWinner={winnerTeamId === match.teamAId}
            score={match.scoreA}
            teamName={getTeamName(match.teamAId, teamMap)}
          />
          <TeamLine
            eliminated={teamBEliminated}
            isThirdPlaceMatch={isThirdPlaceMatch}
            isWinner={winnerTeamId === match.teamBId}
            score={match.scoreB}
            teamName={getTeamName(match.teamBId, teamMap)}
          />
        </div>
      ) : (
        <div className="flex h-[78px] items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.03] px-3 text-center text-sm font-bold text-[#94A3B8]">
          Čeka utakmicu
        </div>
      )}
    </article>
  );
}

function TeamLine({
  eliminated,
  isThirdPlaceMatch,
  isWinner,
  score,
  teamName,
}: {
  eliminated: boolean;
  isThirdPlaceMatch: boolean;
  isWinner: boolean;
  score: number;
  teamName: string;
}) {
  return (
    <div
      className={`grid min-h-9 grid-cols-[minmax(0,1fr)_32px] items-center gap-2 rounded-md border px-2 py-1 ${
        isWinner
          ? "border-[#22C55E]/50 bg-[#22C55E]/10 text-[#86EFAC]"
          : eliminated
            ? "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#FCA5A5]"
            : "border-white/10 bg-white/[0.04] text-white"
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-black">{teamName}</p>
        <p className="text-[10px] font-bold text-[#94A3B8]">
          {isThirdPlaceMatch && isWinner
            ? "Treće mesto"
            : isThirdPlaceMatch && eliminated
              ? "Četvrto mesto"
              : isWinner
                ? "Prošao"
                : eliminated
                  ? "Ispao"
                  : "Čeka"}
        </p>
      </div>
      <p className="text-right text-base font-black">{score}</p>
    </div>
  );
}

function ChampionSlot({
  champion,
  position,
}: {
  champion?: Team;
  position: SlotPosition;
}) {
  return (
    <div
      className="absolute z-10 flex items-center rounded-md border border-[#FACC15]/45 bg-[#FACC15]/10 p-3 shadow-[0_12px_28px_rgba(2,6,23,0.28)]"
      style={{
        height: matchBoxHeight,
        left: position.x,
        top: position.y,
        width: championBoxWidth,
      }}
    >
      <div className="min-w-0">
        <p className="text-xs font-black uppercase text-[#FACC15]">Šampion</p>
        <p className="mt-2 break-words text-base font-black leading-tight text-white">
          {champion?.name ?? "Čeka šampiona"}
        </p>
      </div>
    </div>
  );
}

function buildBracketSlots(
  matches: Match[],
  tournamentId: string,
  teamMap: Map<string, Team>,
  bracketSize: BracketSize,
): BracketSlots {
  const championTeamId = getChampionTeamId(matches, tournamentId);

  return {
    champion: championTeamId ? teamMap.get(championTeamId) : undefined,
    final: createSlot(
      getPhaseMatches(matches, tournamentId, "FINAL")[0],
      "FINAL",
      0,
    ),
    quarterFinals:
      bracketSize === 8
        ? createSlots(
            getPhaseMatches(matches, tournamentId, "QUARTER_FINAL"),
            "QUARTER_FINAL",
            4,
          )
        : [],
    semiFinals:
      bracketSize >= 4
        ? createSlots(
            getPhaseMatches(matches, tournamentId, "SEMI_FINAL"),
            "SEMI_FINAL",
            2,
          )
        : [],
    thirdPlace:
      bracketSize >= 4
        ? createSlot(
            getPhaseMatches(matches, tournamentId, "THIRD_PLACE")[0],
            "THIRD_PLACE",
            0,
          )
        : undefined,
  };
}

function getDisplayBracketSize(
  matches: Match[],
  tournamentId: string,
  teamCount: number,
  knockoutTeams?: number,
): BracketSize {
  if (knockoutTeams === 2 || knockoutTeams === 4 || knockoutTeams === 8) {
    return knockoutTeams;
  }

  if (teamCount === 8) {
    return 4;
  }

  if (
    teamCount > 8 ||
    getPhaseMatches(matches, tournamentId, "QUARTER_FINAL").length > 0
  ) {
    return 8;
  }

  return 4;
}

function createSlots(matches: Match[], phase: MatchPhase, count: number) {
  return Array.from({ length: count }, (_, index) =>
    createSlot(matches[index], phase, index),
  );
}

function createSlot(
  match: Match | undefined,
  phase: MatchPhase,
  index: number,
): BracketSlot {
  return {
    index,
    match,
    phase,
  };
}

function centerY(position: SlotPosition) {
  return position.y + matchBoxHeight / 2;
}

function getTeamName(teamId: string, teamMap: Map<string, Team>) {
  if (!teamId) {
    return "Čeka protivnika";
  }

  return teamMap.get(teamId)?.name ?? "Nepoznata ekipa";
}

function getWinnerTeamId(match: Match) {
  if (match.status !== "FINISHED" || match.scoreA === match.scoreB) {
    return undefined;
  }

  return match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
}
