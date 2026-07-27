import { NextResponse } from "next/server";

import { verifyIdentity } from "@/lib/transport/server/identity";
import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface RefragmentBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
}

// POST /api/rounds/:id/refragment — the host plays a DIFFERENT random fragment of the
// same track, with no penalty.
//
// This is not a game mechanic: it is the host's escape hatch when the fragment that
// came up is unguessable (a silent passage, an intro that is pure ambience). Nothing
// went wrong with the round, so `replay_count` is deliberately left alone — only the
// penalized replay touches it.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: roundId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as RefragmentBody;
  const { sessionId, playerId, reconnectToken } = body;

  if (!sessionId || !playerId || !reconnectToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const identity = await verifyIdentity(admin, sessionId, playerId, reconnectToken);
  if (!identity) return NextResponse.json({ error: "invalid_identity" }, { status: 403 });
  if (!identity.isHost) return NextResponse.json({ error: "not_host" }, { status: 403 });

  const { data: round } = await admin
    .from("rounds")
    .select("id, session_id, phase")
    .eq("id", roundId)
    .maybeSingle();

  if (!round || round.session_id !== sessionId) {
    return NextResponse.json({ error: "round_not_found" }, { status: 404 });
  }
  if (round.phase !== "playing") {
    return NextResponse.json({ error: "round_not_replayable" }, { status: 409 });
  }

  // Same guard as replay: once someone has buzzed, the fragment they heard is the
  // one being judged, so it can no longer change.
  const { count } = await admin
    .from("buzzes")
    .select("id", { count: "exact", head: true })
    .eq("round_id", roundId);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "already_buzzed" }, { status: 409 });
  }

  // Restart the clock so speed scoring measures against the fragment players
  // actually get to hear, not the discarded one.
  const { error } = await admin
    .from("rounds")
    .update({ started_at: new Date().toISOString() })
    .eq("id", roundId);

  if (error) {
    return NextResponse.json({ error: "refragment_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
