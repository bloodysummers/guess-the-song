import { NextResponse } from "next/server";

import type { SessionConfig } from "@/lib/game/types";
import { generateCode } from "@/lib/transport/server/code";
import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface CreateBody {
  hostName?: string;
  playlistId?: string;
  config?: SessionConfig;
  roundsTotal?: number;
}

const UNIQUE_VIOLATION = "23505";

// POST /api/sessions — create a session and its host player.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CreateBody;
  const hostName = body.hostName?.trim();

  if (!hostName || !body.playlistId || !body.config) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Insert the session with a unique code, retrying on collision.
  let sessionId: string | null = null;
  let code = "";
  for (let attempt = 0; attempt < 5 && !sessionId; attempt += 1) {
    code = generateCode();
    const { data, error } = await admin
      .from("sessions")
      .insert({
        code,
        playlist_id: body.playlistId,
        status: "lobby",
        config: body.config,
        rounds_total: body.roundsTotal ?? 10,
      })
      .select("id")
      .single();

    if (!error && data) {
      sessionId = data.id as string;
      break;
    }
    if (error && error.code !== UNIQUE_VIOLATION) {
      return NextResponse.json({ error: "create_failed", detail: error.message }, { status: 500 });
    }
  }

  if (!sessionId) {
    return NextResponse.json({ error: "code_collision" }, { status: 500 });
  }

  // Create the host player (non-scoring presenter/judge).
  const { data: host, error: hostErr } = await admin
    .from("players")
    .insert({ session_id: sessionId, display_name: hostName, is_host: true })
    .select("id, reconnect_token")
    .single();

  if (hostErr || !host) {
    return NextResponse.json(
      { error: "host_create_failed", detail: hostErr?.message },
      { status: 500 },
    );
  }

  await admin.from("sessions").update({ host_player_id: host.id }).eq("id", sessionId);

  return NextResponse.json({
    sessionId,
    sessionCode: code,
    hostPlayerId: host.id,
    reconnectToken: host.reconnect_token,
  });
}
