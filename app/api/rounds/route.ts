import { NextResponse } from "next/server";

import { verifyIdentity } from "@/lib/transport/server/identity";
import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface StartBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
}

interface TrackRow {
  id: string;
  provider: string;
  provider_ref: string;
  answer_title: string;
  answer_artist: string;
  answer_aliases: string[];
  year: number | null;
  album: string | null;
  default_start_ms: number;
}

// POST /api/rounds — host starts (or advances to) a round. Resolves any active round
// as "skipped", picks a random unplayed track, and returns the host-only payload.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as StartBody;
  const { sessionId, playerId, reconnectToken } = body;

  if (!sessionId || !playerId || !reconnectToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const identity = await verifyIdentity(admin, sessionId, playerId, reconnectToken);
  if (!identity) {
    return NextResponse.json({ error: "invalid_identity" }, { status: 403 });
  }
  if (!identity.isHost) {
    return NextResponse.json({ error: "not_host" }, { status: 403 });
  }

  const { data: session } = await admin
    .from("sessions")
    .select("playlist_id, config, rounds_total")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  // Resolve any still-open round as skipped (unjudged rounds).
  await admin
    .from("rounds")
    .update({ phase: "resolved", resolution: "skipped", ended_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .neq("phase", "resolved");

  const { data: priorRounds } = await admin
    .from("rounds")
    .select("track_id, round_number")
    .eq("session_id", sessionId);

  const finishGame = async () => {
    await admin.from("sessions").update({ status: "finished" }).eq("id", sessionId);
    return NextResponse.json({ gameOver: true });
  };

  // End condition 1: the configured number of rounds has been played.
  if ((priorRounds ?? []).length >= (session.rounds_total as number)) {
    return finishGame();
  }

  const usedTrackIds = (priorRounds ?? []).map((r) => r.track_id as string);
  const nextRoundNumber =
    (priorRounds ?? []).reduce((max, r) => Math.max(max, r.round_number as number), 0) + 1;

  let query = admin
    .from("tracks")
    .select(
      "id, provider, provider_ref, answer_title, answer_artist, answer_aliases, year, album, default_start_ms",
    )
    .eq("playlist_id", session.playlist_id);
  if (usedTrackIds.length) {
    query = query.not("id", "in", `(${usedTrackIds.join(",")})`);
  }
  const { data: candidates } = await query;

  // End condition 2: no unplayed tracks remain (graceful end, not an error).
  if (!candidates || candidates.length === 0) {
    return finishGame();
  }

  const track = candidates[Math.floor(Math.random() * candidates.length)] as TrackRow;
  const audioWindowMs = (session.config as { audioWindowMs: number }).audioWindowMs;

  const { data: round, error } = await admin
    .from("rounds")
    .insert({
      session_id: sessionId,
      round_number: nextRoundNumber,
      track_id: track.id,
      audio_window_ms: audioWindowMs,
      phase: "playing",
    })
    .select("id, round_number")
    .single();

  if (error || !round) {
    return NextResponse.json({ error: "round_create_failed", detail: error?.message }, { status: 500 });
  }

  await admin
    .from("sessions")
    .update({ current_round_id: round.id, status: "active" })
    .eq("id", sessionId);

  return NextResponse.json({
    roundId: round.id,
    roundNumber: round.round_number,
    audioWindowMs,
    track: {
      provider: track.provider,
      providerRef: track.provider_ref,
      startMs: track.default_start_ms,
    },
    answer: {
      title: track.answer_title,
      artist: track.answer_artist,
      aliases: track.answer_aliases,
      year: track.year,
      album: track.album,
    },
  });
}
