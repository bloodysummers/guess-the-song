import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface LeaveBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
}

// POST /api/sessions/leave — remove a player after verifying their identity token.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as LeaveBody;
  const { sessionId, playerId, reconnectToken } = body;

  if (!sessionId || !playerId || !reconnectToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: player } = await admin
    .from("players")
    .select("id, reconnect_token, session_id")
    .eq("id", playerId)
    .maybeSingle();

  if (!player || player.session_id !== sessionId || player.reconnect_token !== reconnectToken) {
    return NextResponse.json({ error: "invalid_identity" }, { status: 403 });
  }

  await admin.from("players").delete().eq("id", playerId);

  return NextResponse.json({ ok: true });
}
