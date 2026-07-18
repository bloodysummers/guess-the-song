import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface JoinBody {
  code?: string;
  displayName?: string;
}

const UNIQUE_VIOLATION = "23505";
const MAX_PLAYERS = 20;

// POST /api/sessions/join — join a session in lobby with a unique display name.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as JoinBody;
  const name = body.displayName?.trim();
  const code = body.code?.trim().toUpperCase();

  if (!code || !name) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: session } = await admin
    .from("sessions")
    .select("id, status")
    .eq("code", code)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (session.status !== "lobby") {
    return NextResponse.json({ error: "session_not_joinable" }, { status: 409 });
  }

  const { count } = await admin
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .eq("is_host", false);

  if ((count ?? 0) >= MAX_PLAYERS) {
    return NextResponse.json({ error: "session_full" }, { status: 409 });
  }

  const { data: player, error } = await admin
    .from("players")
    .insert({ session_id: session.id, display_name: name, is_host: false })
    .select("id, reconnect_token")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json({ error: "name_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "join_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: session.id,
    playerId: player.id,
    reconnectToken: player.reconnect_token,
  });
}
