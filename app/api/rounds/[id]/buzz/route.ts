import { NextResponse } from "next/server";

import { verifyIdentity } from "@/lib/transport/server/identity";
import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface BuzzBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
}

const UNIQUE_VIOLATION = "23505";

// POST /api/rounds/:id/buzz — a player buzzes. The server seals the timestamp; the
// first buzz flips the round to "answering" with the earliest buzzer as answerer.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: roundId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as BuzzBody;
  const { sessionId, playerId, reconnectToken } = body;

  if (!sessionId || !playerId || !reconnectToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const identity = await verifyIdentity(admin, sessionId, playerId, reconnectToken);
  if (!identity) {
    return NextResponse.json({ error: "invalid_identity" }, { status: 403 });
  }
  if (identity.isHost) {
    return NextResponse.json({ error: "host_cannot_buzz" }, { status: 403 });
  }

  const { data: round } = await admin
    .from("rounds")
    .select("id, session_id, game_id, phase")
    .eq("id", roundId)
    .maybeSingle();

  if (!round || round.session_id !== sessionId) {
    return NextResponse.json({ error: "round_not_found" }, { status: 404 });
  }
  if (round.phase === "resolved") {
    return NextResponse.json({ error: "round_not_open" }, { status: 409 });
  }

  // Insert the buzz; server_ts defaults to now(). unique(round_id, player_id) blocks a
  // second buzz from the same player.
  const { error } = await admin
    .from("buzzes")
    .insert({ round_id: roundId, player_id: playerId, session_id: sessionId, game_id: round.game_id });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json({ error: "already_buzzed" }, { status: 409 });
    }
    return NextResponse.json({ error: "buzz_failed", detail: error.message }, { status: 500 });
  }

  // Transition to answering exactly once, with the earliest buzzer as current answerer.
  const { data: earliest } = await admin
    .from("buzzes")
    .select("player_id")
    .eq("round_id", roundId)
    .order("server_ts", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (earliest) {
    await admin
      .from("rounds")
      .update({ phase: "answering", current_answerer_id: earliest.player_id })
      .eq("id", roundId)
      .eq("phase", "playing");
  }

  return NextResponse.json({ ok: true });
}
