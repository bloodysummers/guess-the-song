import { NextResponse } from "next/server";

import type { SessionConfig } from "@/lib/game/types";
import { verifyIdentity } from "@/lib/transport/server/identity";
import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface CreateGameBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
  playlistId?: string;
  config?: SessionConfig;
  roundsTotal?: number;
}

// POST /api/games — host starts a new game in a session. Ends any active game first,
// creates the game, and initializes a per-game scoreboard at zero for the players.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CreateGameBody;
  const { sessionId, playerId, reconnectToken, playlistId, config } = body;

  if (!sessionId || !playerId || !reconnectToken || !playlistId || !config) {
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
      playlist_id: playlistId,
      config,
      rounds_total: body.roundsTotal ?? 10,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !game) {
    return NextResponse.json({ error: "game_create_failed", detail: error?.message }, { status: 500 });
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

  return NextResponse.json({ gameId: game.id });
}
