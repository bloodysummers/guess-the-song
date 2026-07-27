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

// POST /api/rounds/:id/judge — the host judges the current answerer (game-scoped).
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
    .select(
      "id, session_id, game_id, phase, current_answerer_id, game_track_id, audio_window_ms, started_at, replay_count",
    )
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

  const gameId = round.game_id as string;
  const { data: game } = await admin
    .from("games")
    .select("config")
    .eq("id", gameId)
    .maybeSingle();
  const config = (game?.config ?? {}) as { scoringMode?: ScoringMode; allowSteal?: boolean };
  const mode = config.scoringMode ?? "simple";
  const allowSteal = config.allowSteal ?? true;

  // The reveal comes from the game's own snapshot, so it works for any source.
  const revealFromTrack = async () => {
    const { data: track } = await admin
      .from("game_tracks")
      .select("answer_title, answer_artist, year, artwork_url")
      .eq("id", round.game_track_id)
      .maybeSingle();
    return {
      revealed_title: track?.answer_title ?? null,
      revealed_artist: track?.answer_artist ?? null,
      revealed_year: track?.year ?? null,
      revealed_artwork_url: track?.artwork_url ?? null,
    };
  };

  if (verdict === "correct") {
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

    // A replayed round applies a penalty modifier to the award.
    const REPLAY_PENALTY = 0.5;
    const modifier = (round.replay_count as number) >= 1 ? REPLAY_PENALTY : 1;

    const points = computeAward({
      mode,
      audioWindowMs: round.audio_window_ms,
      timeToBuzzMs,
      extras: 0,
      modifier,
    });

    await admin.from("judgements").insert({
      round_id: roundId,
      session_id: sessionId,
      game_id: gameId,
      player_id: targetPlayerId,
      verdict: "correct",
      awarded_points: points,
      bonus_flags: body.bonusFlags ?? {},
    });

    // Add points to this game's scoreboard (row was seeded at game creation).
    const { data: gs } = await admin
      .from("game_scores")
      .select("score")
      .eq("game_id", gameId)
      .eq("player_id", targetPlayerId)
      .maybeSingle();
    await admin
      .from("game_scores")
      .upsert(
        { game_id: gameId, player_id: targetPlayerId, score: (gs?.score ?? 0) + points },
        { onConflict: "game_id,player_id" },
      );

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
    game_id: gameId,
    player_id: targetPlayerId,
    verdict: "incorrect",
    awarded_points: 0,
  });

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
