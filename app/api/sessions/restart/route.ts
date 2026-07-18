import { NextResponse } from "next/server";

import { verifyIdentity } from "@/lib/transport/server/identity";
import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface RestartBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
}

// POST /api/sessions/restart — host resets the game to play again with the same players.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RestartBody;
  const { sessionId, playerId, reconnectToken } = body;

  if (!sessionId || !playerId || !reconnectToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const identity = await verifyIdentity(admin, sessionId, playerId, reconnectToken);
  if (!identity) return NextResponse.json({ error: "invalid_identity" }, { status: 403 });
  if (!identity.isHost) return NextResponse.json({ error: "not_host" }, { status: 403 });

  // Clear the session back to the lobby (rounds cascade-delete buzzes and judgements).
  await admin.from("sessions").update({ current_round_id: null }).eq("id", sessionId);
  await admin.from("rounds").delete().eq("session_id", sessionId);
  await admin.from("players").update({ score: 0 }).eq("session_id", sessionId);
  await admin.from("sessions").update({ status: "lobby" }).eq("id", sessionId);

  return NextResponse.json({ ok: true });
}
