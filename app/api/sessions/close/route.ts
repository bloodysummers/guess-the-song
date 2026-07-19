import { NextResponse } from "next/server";

import { verifyIdentity } from "@/lib/transport/server/identity";
import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface CloseBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
}

// POST /api/sessions/close — host closes the session for everyone.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CloseBody;
  const { sessionId, playerId, reconnectToken } = body;

  if (!sessionId || !playerId || !reconnectToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const identity = await verifyIdentity(admin, sessionId, playerId, reconnectToken);
  if (!identity) return NextResponse.json({ error: "invalid_identity" }, { status: 403 });
  if (!identity.isHost) return NextResponse.json({ error: "not_host" }, { status: 403 });

  await admin.from("sessions").update({ status: "closed" }).eq("id", sessionId);

  return NextResponse.json({ ok: true });
}
