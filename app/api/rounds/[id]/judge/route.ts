import { NextResponse } from "next/server";

import { computeAward } from "@/lib/game/scoring";
import type { ScoringMode, Verdict } from "@/lib/game/types";
import { verifyIdentity } from "@/lib/transport/server/identity";
import { getSupabaseAdmin } from "@/lib/transport/server/supabase-admin";

interface JudgeBody {
  sessionId?: string;
  playerId?: string;
  reconnectToken?: string;
  targetPlayerId?: string;
  verdict?: Verdict;
  bonusFlags?: Record<string, boolean>;
}

// POST /api/rounds/:id/judge — the host judges the current answerer.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: roundId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as JudgeBody;
  const { sessionId, playerId, reconnectToken, targetPlayerId, verdict } = body;

  if (!sessionId || !playerId || !reconnectToken || !targetPlayerId || !verdict) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const identity = await verifyIdentity(admin, sessionId, playerId, reconnectToken);
  if (!identity) return NextResponse.json({ error: "invalid_identity" }, { status: 403 });
  if (!identity.isHost) return NextResponse.json({ error: "not_host" }, { status: 403 });

  const { data: round } = await admin
    .from("rounds")
    .select("id, session_id, phase, current_answerer_id, track_id, audio_window_ms, started_at")
    .eq("id", roundId)
    .maybeSingle();

  if (!round || round.session_id !== sessionId) {
    return NextResponse.json({ error: "round_not_found" }, { status: 404 });
  }
  if (round.phase !== "answering") {
    return NextResponse.json({ error: "not_answering" }, { status: 409 });
  }
  if (round.current_answerer_id !== targetPlayerId) {
    return NextResponse.json({ error: "not_current_answerer" }, { status: 409 });
  }

  const revealFromTrack = async () => {
    const { data: track } = await admin
      .from("tracks")
      .select("answer_title, answer_artist, year")
      .eq("id", round.track_id)
      .maybeSingle();
    return {
      revealed_title: track?.answer_title ?? null,
      revealed_artist: track?.answer_artist ?? null,
      revealed_year: track?.year ?? null,
    };
  };

  if (verdict === "correct") {
    const { data: session } = await admin
      .from("sessions")
      .select("config")
      .eq("id", sessionId)
      .maybeSingle();
    const mode = (session?.config as { scoringMode?: ScoringMode })?.scoringMode ?? "simple";

    const { data: buzz } = await admin
      .from("buzzes")
      .select("server_ts")
      .eq("round_id", roundId)
      .eq("player_id", targetPlayerId)
      .maybeSingle();

    const timeToBuzzMs =
      buzz && round.started_at
        ? new Date(buzz.server_ts).getTime() - new Date(round.started_at).getTime()
        : 0;

    const points = computeAward({
      mode,
      audioWindowMs: round.audio_window_ms,
      timeToBuzzMs,
      extras: 0,
    });

    await admin.from("judgements").insert({
      round_id: roundId,
      session_id: sessionId,
      player_id: targetPlayerId,
      verdict: "correct",
      awarded_points: points,
      bonus_flags: body.bonusFlags ?? {},
    });

    const { data: player } = await admin
      .from("players")
      .select("score")
      .eq("id", targetPlayerId)
      .maybeSingle();
    await admin
      .from("players")
      .update({ score: (player?.score ?? 0) + points })
      .eq("id", targetPlayerId);

    await admin
      .from("rounds")
      .update({
        phase: "resolved",
        resolution: "correct",
        winner_player_id: targetPlayerId,
        ended_at: new Date().toISOString(),
        ...(await revealFromTrack()),
      })
      .eq("id", roundId);

    return NextResponse.json({ ok: true, resolution: "correct", awardedPoints: points });
  }

  // Incorrect: record it, then pass to the next un-judged buzzer (or exhaust the round).
  await admin.from("judgements").insert({
    round_id: roundId,
    session_id: sessionId,
    player_id: targetPlayerId,
    verdict: "incorrect",
    awarded_points: 0,
  });

  const { data: session } = await admin
    .from("sessions")
    .select("config")
    .eq("id", sessionId)
    .maybeSingle();
  const allowSteal = (session?.config as { allowSteal?: boolean })?.allowSteal ?? true;

  const { data: judged } = await admin
    .from("judgements")
    .select("player_id")
    .eq("round_id", roundId);
  const judgedSet = new Set((judged ?? []).map((j) => j.player_id as string));

  const { data: buzzes } = await admin
    .from("buzzes")
    .select("player_id")
    .eq("round_id", roundId)
    .order("server_ts", { ascending: true });

  const next = allowSteal
    ? (buzzes ?? []).map((b) => b.player_id as string).find((pid) => !judgedSet.has(pid))
    : undefined;

  if (next) {
    await admin.from("rounds").update({ current_answerer_id: next }).eq("id", roundId);
    return NextResponse.json({ ok: true, resolution: null, nextAnswererId: next });
  }

  await admin
    .from("rounds")
    .update({
      phase: "resolved",
      resolution: "exhausted",
      ended_at: new Date().toISOString(),
      ...(await revealFromTrack()),
    })
    .eq("id", roundId);

  return NextResponse.json({ ok: true, resolution: "exhausted" });
}
