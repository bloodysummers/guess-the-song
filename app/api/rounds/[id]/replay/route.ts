import { NextResponse } from "next/server";

import { verifyIdentity } from "@/lib/transport/server/identity";
import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface ReplayBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
}

// POST /api/rounds/:id/replay — host replays the audio window before any buzz.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: roundId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as ReplayBody;
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
    .select("id, session_id, phase, replay_count")
    .eq("id", roundId)
    .maybeSingle();

  if (!round || round.session_id !== sessionId) {
    return NextResponse.json({ error: "round_not_found" }, { status: 404 });
  }
  if (round.phase !== "playing") {
    return NextResponse.json({ error: "round_not_replayable" }, { status: 409 });
  }

  const { count } = await admin
    .from("buzzes")
    .select("id", { count: "exact", head: true })
    .eq("round_id", roundId);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "already_buzzed" }, { status: 409 });
  }

  const replayCount = (round.replay_count as number) + 1;
  await admin.from("rounds").update({ replay_count: replayCount }).eq("id", roundId);

  return NextResponse.json({ ok: true, replayCount });
}
