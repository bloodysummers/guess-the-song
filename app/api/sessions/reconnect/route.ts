import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface ReconnectBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
}

// POST /api/sessions/reconnect — verify a stored identity and readmit the player.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ReconnectBody;
  const { sessionId, playerId, reconnectToken } = body;

  if (!sessionId || !playerId || !reconnectToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: player } = await admin
    .from("players")
    .select("id, is_host, display_name, reconnect_token, session_id")
    .eq("id", playerId)
    .maybeSingle();

  if (!player || player.session_id !== sessionId || player.reconnect_token !== reconnectToken) {
    return NextResponse.json({ error: "invalid_identity" }, { status: 403 });
  }

  const { data: session } = await admin
    .from("sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.status === "closed") {
    return NextResponse.json({ error: "session_over" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    playerId: player.id,
    isHost: player.is_host,
    displayName: player.display_name,
  });
}
