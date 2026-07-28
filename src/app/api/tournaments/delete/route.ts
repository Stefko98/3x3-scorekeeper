import { NextResponse } from "next/server";
import { createAutomaticBackup } from "../../../lib/automatic-backup";
import {
  createDeletionTombstone,
  isDeletionTombstone,
  readSharedStore,
  runSharedStoreOperation,
  writeSharedStore,
  type SharedStoreItem,
} from "../../../lib/server-shared-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const storeKeys = {
  events: "3x3-tournament-manager:match-events",
  matches: "3x3-tournament-manager:matches",
  players: "3x3-tournament-manager:players",
  teams: "3x3-tournament-manager:teams",
  tournaments: "3x3-tournament-manager:tournaments",
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const tournamentId = formData.get("tournamentId");

  if (typeof tournamentId !== "string" || !tournamentId) {
    return NextResponse.redirect(getTournamentsRedirectUrl(request), 303);
  }

  await createAutomaticBackup({ forceHistory: true });

  const [{ items: teams }, { items: matches }] = await Promise.all([
    readSharedStore(storeKeys.teams),
    readSharedStore(storeKeys.matches),
  ]);
  const deletedTeamIds = new Set(
    teams
      .filter((team) => team.tournamentId === tournamentId)
      .map((team) => team.id),
  );
  const deletedMatchIds = new Set(
    matches
      .filter((match) => match.tournamentId === tournamentId)
      .map((match) => match.id),
  );
  const deletedAt = new Date().toISOString();

  await Promise.all([
    deleteStoreItems(
      storeKeys.tournaments,
      (tournament) => tournament.id === tournamentId,
      deletedAt,
    ),
    deleteStoreItems(
      storeKeys.teams,
      (team) => team.tournamentId === tournamentId,
      deletedAt,
    ),
    deleteStoreItems(
      storeKeys.players,
      (player) =>
        player.tournamentId === tournamentId ||
        deletedTeamIds.has(String(player.teamId ?? "")),
      deletedAt,
    ),
    deleteStoreItems(
      storeKeys.matches,
      (match) => match.tournamentId === tournamentId,
      deletedAt,
    ),
    deleteStoreItems(
      storeKeys.events,
      (event) =>
        event.tournamentId === tournamentId ||
        deletedMatchIds.has(String(event.matchId ?? "")),
      deletedAt,
    ),
  ]);

  await createAutomaticBackup();

  return NextResponse.redirect(getTournamentsRedirectUrl(request), 303);
}

async function deleteStoreItems(
  key: string,
  shouldDelete: (item: SharedStoreItem) => boolean,
  deletedAt: string,
) {
  await runSharedStoreOperation(key, async () => {
    const { items } = await readSharedStore(key);
    const nextItems = items.flatMap((item) => {
      if (isDeletionTombstone(item) || !shouldDelete(item)) {
        return [item];
      }

      return [createDeletionTombstone(item.id, deletedAt)];
    });

    await writeSharedStore(key, nextItems);
  });
}

function getTournamentsRedirectUrl(request: Request) {
  const origin = getHeaderUrl(request.headers.get("origin"));

  if (origin) {
    return new URL("/tournaments", origin);
  }

  const referer = getHeaderUrl(request.headers.get("referer"));

  if (referer) {
    return new URL("/tournaments", referer);
  }

  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";

  if (host && !host.startsWith("0.0.0.0")) {
    return new URL(`${protocol}://${host}/tournaments`);
  }

  return new URL("http://localhost:3000/tournaments");
}

function getHeaderUrl(value: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (url.hostname === "0.0.0.0") {
      return undefined;
    }

    return url;
  } catch {
    return undefined;
  }
}
