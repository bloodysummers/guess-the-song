import { NextResponse } from "next/server";

import type { GameSource, SessionConfig } from "@/lib/game/types";
import { GameSourceError, resolveGameSource } from "@/lib/transport/server/game-source";
import { verifyIdentity } from "@/lib/transport/server/identity";
import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface CreateGameBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
  source?: GameSource;
  config?: SessionConfig;
  roundsTotal?: number;
}

/** Source problems are the host's to fix (bad URL, empty playlist), not server faults. */
const SOURCE_ERROR_STATUS: Record<string, number> = {
  invalid_source: 400,
  invalid_youtube_url: 400,
  playlist_not_found: 404,
  playlist_empty: 422,
  youtube_not_configured: 503,
  youtube_api_error: 502,
  source_read_failed: 500,
};

// POST /api/games — host starts a new game in a session. Resolves the source into
// the game's own track snapshot, ends any active game, creates the game, and
// initializes a per-game scoreboard at zero for the players.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CreateGameBody;
  const { sessionId, playerId, reconnectToken, source, config } = body;

  if (!sessionId || !playerId || !reconnectToken || !source || !config) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const identity = await verifyIdentity(admin, sessionId, playerId, reconnectToken);
  if (!identity) return NextResponse.json({ error: "invalid_identity" }, { status: 403 });
  if (!identity.isHost) return NextResponse.json({ error: "not_host" }, { status: 403 });

  const { data: session } = await admin
    .from("sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  if (session.status !== "open") {
    return NextResponse.json({ error: "session_closed" }, { status: 409 });
  }

  // Read the source FIRST: an unreadable playlist must leave the session untouched,
  // with no game created and the previous game still standing.
  let resolved;
  try {
    resolved = await resolveGameSource(admin, source);
  } catch (err) {
    if (err instanceof GameSourceError) {
      return NextResponse.json(
        { error: err.code },
        { status: SOURCE_ERROR_STATUS[err.code] ?? 400 },
      );
    }
    throw err;
  }

  // Only one active game at a time — finish any lingering active game.
  await admin
    .from("games")
    .update({ status: "finished", ended_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("status", "active");

  const { data: game, error } = await admin
    .from("games")
    .insert({
      session_id: sessionId,
      game_type: "guess-the-song",
      source_label: resolved.label,
      config,
      rounds_total: body.roundsTotal ?? 10,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !game) {
    return NextResponse.json({ error: "game_create_failed", detail: error?.message }, { status: 500 });
  }

  // Materialize the game's own track set. Without it the game cannot run, so a
  // failure here rolls the game back rather than leaving an unplayable one.
  const { error: tracksError } = await admin
    .from("game_tracks")
    .insert(resolved.tracks.map((t) => ({ ...t, game_id: game.id })));

  if (tracksError) {
    await admin.from("games").delete().eq("id", game.id);
    return NextResponse.json(
      { error: "game_tracks_create_failed", detail: tracksError.message },
      { status: 500 },
    );
  }

  // Initialize the per-game scoreboard at zero for every non-host player.
  const { data: players } = await admin
    .from("players")
    .select("id, is_host")
    .eq("session_id", sessionId);
  const rows = ((players as { id: string; is_host: boolean }[] | null) ?? [])
    .filter((p) => !p.is_host)
    .map((p) => ({ game_id: game.id, player_id: p.id, score: 0 }));
  if (rows.length) {
    await admin.from("game_scores").insert(rows);
  }

  return NextResponse.json({
    gameId: game.id,
    sourceLabel: resolved.label,
    trackCount: resolved.tracks.length,
  });
}
