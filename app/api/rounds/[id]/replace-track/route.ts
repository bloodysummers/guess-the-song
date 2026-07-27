import { NextResponse } from "next/server";

import { verifyIdentity } from "@/lib/transport/server/identity";
import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface ReplaceBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
  /** Why the track failed, for the server log. */
  reason?: string;
}

interface GameTrackRow {
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

const TRACK_COLUMNS =
  "id, provider, provider_ref, answer_title, answer_artist, answer_aliases, year, album, default_start_ms";

// POST /api/rounds/:id/replace-track — the host's player could not play the track
// (region block, embedding disabled, dead video). Swap in another track WITHOUT
// consuming a round: the players lose nothing to a broken video.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: roundId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as ReplaceBody;
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
    .select("id, session_id, game_id, phase, game_track_id, audio_window_ms")
    .eq("id", roundId)
    .maybeSingle();

  if (!round || round.session_id !== sessionId) {
    return NextResponse.json({ error: "round_not_found" }, { status: 404 });
  }
  // Once someone has buzzed, the round is in play and the track is what it is.
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

  const gameId = round.game_id as string;

  // Flag the bad track so it is never drawn again in this game.
  await admin.from("game_tracks").update({ unplayable: true }).eq("id", round.game_track_id);

  // Exclude every track already used by a round of this game, plus the flagged ones.
  const { data: priorRounds } = await admin
    .from("rounds")
    .select("game_track_id")
    .eq("game_id", gameId);
  const usedIds = (priorRounds ?? []).map((r) => r.game_track_id as string);

  let query = admin
    .from("game_tracks")
    .select(TRACK_COLUMNS)
    .eq("game_id", gameId)
    .eq("unplayable", false);
  if (usedIds.length) {
    query = query.not("id", "in", `(${usedIds.join(",")})`);
  }
  const { data: candidates } = await query;

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ error: "no_playable_tracks_left" }, { status: 409 });
  }

  const track = candidates[Math.floor(Math.random() * candidates.length)] as GameTrackRow;

  // Restart the clock: speed scoring measures from when the audio actually began,
  // and for this round that is now.
  const { error } = await admin
    .from("rounds")
    .update({ game_track_id: track.id, started_at: new Date().toISOString() })
    .eq("id", roundId);

  if (error) {
    return NextResponse.json({ error: "replace_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    roundId,
    audioWindowMs: round.audio_window_ms,
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
