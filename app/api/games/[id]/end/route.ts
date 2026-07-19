import { NextResponse } from "next/server";

import { verifyIdentity } from "@/lib/transport/server/identity";
import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface EndBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
}

// POST /api/games/:id/end — host ends a game (returns the session to the hub).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: gameId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as EndBody;
  const { sessionId, playerId, reconnectToken } = body;

  if (!sessionId || !playerId || !reconnectToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const identity = await verifyIdentity(admin, sessionId, playerId, reconnectToken);
  if (!identity) return NextResponse.json({ error: "invalid_identity" }, { status: 403 });
  if (!identity.isHost) return NextResponse.json({ error: "not_host" }, { status: 403 });

  await admin
    .from("games")
    .update({ status: "finished", ended_at: new Date().toISOString() })
    .eq("id", gameId)
    .eq("session_id", sessionId);

  return NextResponse.json({ ok: true });
}
