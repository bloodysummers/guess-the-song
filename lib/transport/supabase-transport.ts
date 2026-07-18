/**
 * SupabaseTransport — implementation of GameTransport.
 *
 * The ONLY module tree allowed to import the Supabase SDK. Mutations go through
 * server Route Handlers (service role); reads and presence use the browser anon
 * client over Realtime.
 *
 * Lobby actions (create/join/resume/leave/presence) are implemented. Gameplay
 * actions (startRound/buzz/judge/...) remain stubs until their phases.
 */

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type {
  AnswerReference,
  BuzzQueueEntry,
  PlayerPublic,
  RoundResolution,
  SessionConfig,
  SessionStatus,
  TrackRef,
} from "@/lib/game/types";
import {
  TransportError,
  type Ack,
  type BuzzInput,
  type CreateSessionInput,
  type CreateSessionResult,
  type GameEventHandler,
  type GameEventMap,
  type GameEventName,
  type GameTransport,
  type JoinSessionInput,
  type JoinSessionResult,
  type JudgeInput,
  type ResumeInput,
  type ResumeResult,
  type StartRoundResult,
} from "@/lib/transport/game-transport";
import { getSupabaseBrowser } from "@/lib/transport/browser-client";

interface PlayerRow {
  id: string;
  display_name: string;
  is_host: boolean;
}

interface SessionRow {
  status: SessionStatus;
  config: SessionConfig;
  rounds_total: number;
}

interface RoundRow {
  id: string;
  round_number: number;
  audio_window_ms: number;
  phase: string;
}

interface BuzzRow {
  round_id: string;
  player_id: string;
  server_ts: string;
}

interface RoundUpdateRow {
  id: string;
  phase: string;
  current_answerer_id: string | null;
  resolution: RoundResolution | null;
  winner_player_id: string | null;
  revealed_title: string | null;
  revealed_artist: string | null;
  revealed_year: number | null;
}

interface JudgementRow {
  round_id: string;
  player_id: string;
  verdict: "correct" | "incorrect";
  awarded_points: number;
}

interface StartRoundHostResult {
  roundId: string;
  roundNumber: number;
  audioWindowMs: number;
  track: TrackRef;
  answer: AnswerReference;
}

function toPublic(row: PlayerRow): PlayerPublic {
  return { id: row.id, displayName: row.display_name, isHost: row.is_host };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!res.ok) {
    throw new TransportError(data.error ?? "request_failed", res.status);
  }
  return data as T;
}

function notImplemented(method: string): never {
  throw new Error(`SupabaseTransport.${method}() is not implemented yet (see roadmap phases).`);
}

export class SupabaseTransport implements GameTransport {
  private readonly browser: SupabaseClient;
  private readonly handlers = new Map<GameEventName, Set<GameEventHandler<GameEventName>>>();

  private sessionId: string | null = null;
  private playerId: string | null = null;
  private reconnectToken: string | null = null;
  private isHost = false;
  private channel: RealtimeChannel | null = null;

  private currentRoundId: string | null = null;
  private currentAnswererId: string | null = null;
  private buzzQueue: { playerId: string; serverTs: string }[] = [];

  constructor(client?: SupabaseClient) {
    this.browser = client ?? getSupabaseBrowser();
  }

  // --- Lobby actions ------------------------------------------------------

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const result = await postJson<CreateSessionResult>("/api/sessions", {
      hostName: input.hostName,
      playlistId: input.playlistId,
      config: input.config,
      roundsTotal: input.roundsTotal,
    });
    this.setContext(result.sessionId, result.hostPlayerId, true, result.reconnectToken);
    await this.subscribe();
    return result;
  }

  async joinSession(input: JoinSessionInput): Promise<JoinSessionResult> {
    const result = await postJson<JoinSessionResult>("/api/sessions/join", {
      code: input.code,
      displayName: input.displayName,
    });
    this.setContext(result.sessionId, result.playerId, false, result.reconnectToken);
    await this.subscribe();
    return result;
  }

  async resume(input: ResumeInput): Promise<ResumeResult> {
    const result = await postJson<ResumeResult>("/api/sessions/reconnect", input);
    this.setContext(input.sessionId, result.playerId, result.isHost, input.reconnectToken);
    await this.subscribe();
    return result;
  }

  async leave(): Promise<Ack> {
    if (this.sessionId && this.playerId && this.reconnectToken) {
      await postJson("/api/sessions/leave", {
        sessionId: this.sessionId,
        playerId: this.playerId,
        reconnectToken: this.reconnectToken,
      }).catch(() => undefined);
    }
    await this.disconnect();
    return { ok: true };
  }

  async presence(): Promise<string[]> {
    if (!this.channel) return [];
    return Object.keys(this.channel.presenceState());
  }

  // --- Round & buzzer actions ---------------------------------------------

  async startRound(): Promise<StartRoundResult> {
    const res = await postJson<StartRoundHostResult & { gameOver?: boolean }>("/api/rounds", {
      sessionId: this.sessionId,
      playerId: this.playerId,
      reconnectToken: this.reconnectToken,
    });
    if (res.gameOver) {
      // The game ended; the session UPDATE (finished) drives the podium.
      return { roundId: "" };
    }
    // Host-only: the track + answer are delivered only in this response.
    this.dispatch("round_host_payload", {
      roundId: res.roundId,
      audioWindowMs: res.audioWindowMs,
      track: res.track,
      answer: res.answer,
    });
    return { roundId: res.roundId };
  }

  async restart(): Promise<Ack> {
    await postJson("/api/sessions/restart", {
      sessionId: this.sessionId,
      playerId: this.playerId,
      reconnectToken: this.reconnectToken,
    });
    return { ok: true };
  }

  nextRound(): Promise<StartRoundResult> {
    // The endpoint resolves the active round as skipped, then starts a new one.
    return this.startRound();
  }

  async buzz(input: BuzzInput): Promise<Ack> {
    await postJson(`/api/rounds/${input.roundId}/buzz`, {
      sessionId: this.sessionId,
      playerId: this.playerId,
      reconnectToken: this.reconnectToken,
    });
    return { ok: true };
  }

  async judge(input: JudgeInput): Promise<Ack> {
    await postJson(`/api/rounds/${input.roundId}/judge`, {
      sessionId: this.sessionId,
      playerId: this.playerId,
      reconnectToken: this.reconnectToken,
      targetPlayerId: input.playerId,
      verdict: input.verdict,
      bonusFlags: input.bonusFlags,
    });
    return { ok: true };
  }

  // --- Gameplay actions (stubs) -------------------------------------------

  endGame(): Promise<Ack> {
    return notImplemented("endGame");
  }

  // --- Event subscription -------------------------------------------------

  on<E extends GameEventName>(event: E, handler: GameEventHandler<E>): void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as GameEventHandler<GameEventName>);
    this.handlers.set(event, set);
  }

  off<E extends GameEventName>(event: E, handler: GameEventHandler<E>): void {
    this.handlers.get(event)?.delete(handler as GameEventHandler<GameEventName>);
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.browser.removeChannel(this.channel);
      this.channel = null;
    }
    // NOTE: event handlers are intentionally kept. They are the UI's subscriptions
    // and must survive leaving one session and joining another on the same transport.
    this.sessionId = null;
    this.playerId = null;
    this.reconnectToken = null;
    this.isHost = false;
    this.currentRoundId = null;
    this.currentAnswererId = null;
    this.buzzQueue = [];
  }

  // --- Internals ----------------------------------------------------------

  private setContext(
    sessionId: string,
    playerId: string,
    isHost: boolean,
    reconnectToken: string,
  ): void {
    this.sessionId = sessionId;
    this.playerId = playerId;
    this.isHost = isHost;
    this.reconnectToken = reconnectToken;
  }

  private dispatch<E extends GameEventName>(event: E, payload: GameEventMap[E]): void {
    this.handlers.get(event)?.forEach((handler) => {
      (handler as GameEventHandler<E>)(payload);
    });
  }

  private async subscribe(): Promise<void> {
    const sessionId = this.sessionId;
    const playerId = this.playerId;
    if (!sessionId || !playerId) return;

    if (this.channel) {
      await this.browser.removeChannel(this.channel);
      this.channel = null;
    }

    const channel = this.browser.channel(`session:${sessionId}`, {
      config: { presence: { key: playerId } },
    });

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "players", filter: `session_id=eq.${sessionId}` },
      (payload) => {
        this.dispatch("player_joined", { player: toPublic(payload.new as PlayerRow) });
      },
    );

    channel.on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "players", filter: `session_id=eq.${sessionId}` },
      (payload) => {
        const old = payload.old as { id?: string };
        if (old.id) this.dispatch("player_left", { playerId: old.id });
      },
    );

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
      (payload) => {
        const s = payload.new as SessionRow;
        this.dispatch("session_updated", {
          status: s.status,
          config: s.config,
          roundsTotal: s.rounds_total,
          currentRoundNumber: null,
        });
        if (s.status === "finished") void this.emitGameEnded();
      },
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "rounds", filter: `session_id=eq.${sessionId}` },
      (payload) => {
        const r = payload.new as RoundRow;
        this.currentRoundId = r.id;
        this.currentAnswererId = null;
        this.buzzQueue = [];
        this.dispatch("round_started", {
          roundId: r.id,
          roundNumber: r.round_number,
          audioWindowMs: r.audio_window_ms,
          buzzEnabled: true,
        });
      },
    );

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "rounds", filter: `session_id=eq.${sessionId}` },
      (payload) => this.handleRoundUpdate(payload.new as RoundUpdateRow),
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "buzzes", filter: `session_id=eq.${sessionId}` },
      (payload) => this.handleBuzz(payload.new as BuzzRow),
    );

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "judgements",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => this.handleJudgement(payload.new as JudgementRow),
    );

    channel.on("presence", { event: "sync" }, () => {
      this.dispatch("presence_updated", {
        onlinePlayerIds: Object.keys(channel.presenceState()),
      });
    });

    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
      });
    });

    await channel.track({ playerId });
    this.channel = channel;

    await this.emitInitialRoster();
    await this.emitCurrentRound();
    await this.emitSession();
  }

  private async emitSession(): Promise<void> {
    const { data } = await this.browser
      .from("sessions")
      .select("status, config, rounds_total")
      .eq("id", this.sessionId)
      .maybeSingle();
    const s = data as { status: SessionStatus; config: SessionConfig; rounds_total: number } | null;
    if (!s) return;
    this.dispatch("session_updated", {
      status: s.status,
      config: s.config,
      roundsTotal: s.rounds_total,
      currentRoundNumber: null,
    });
    if (s.status === "finished") await this.emitGameEnded();
  }

  private async emitGameEnded(): Promise<void> {
    const { data } = await this.browser
      .from("players")
      .select("id, display_name, score, is_host")
      .eq("session_id", this.sessionId);
    const ranked = (
      (data as { id: string; display_name: string; score: number; is_host: boolean }[] | null) ??
      []
    )
      .filter((p) => !p.is_host)
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({
        playerId: p.id,
        displayName: p.display_name,
        total: p.score,
        position: i + 1,
      }));
    this.dispatch("game_ended", { podium: ranked });
  }

  private async emitInitialRoster(): Promise<void> {
    const { data } = await this.browser
      .from("players")
      .select("id, display_name, is_host")
      .eq("session_id", this.sessionId);
    (data as PlayerRow[] | null)?.forEach((row) => {
      this.dispatch("player_joined", { player: toPublic(row) });
    });
  }

  /** On (re)connect, replay the active round and any buzzes already placed. */
  private async emitCurrentRound(): Promise<void> {
    const { data: session } = await this.browser
      .from("sessions")
      .select("current_round_id")
      .eq("id", this.sessionId)
      .maybeSingle();
    const currentRoundId = (session as { current_round_id: string | null } | null)?.current_round_id;
    if (!currentRoundId) return;

    const { data: round } = await this.browser
      .from("rounds")
      .select("id, round_number, audio_window_ms, phase, current_answerer_id")
      .eq("id", currentRoundId)
      .maybeSingle();
    const r = round as (RoundRow & { current_answerer_id: string | null }) | null;

    // Always refresh the scoreboard on (re)connect.
    await this.emitScoreUpdate();

    if (!r || r.phase === "resolved") return;

    this.currentRoundId = r.id;
    this.currentAnswererId = r.current_answerer_id;
    this.buzzQueue = [];
    this.dispatch("round_started", {
      roundId: r.id,
      roundNumber: r.round_number,
      audioWindowMs: r.audio_window_ms,
      buzzEnabled: true,
    });

    const { data: buzzes } = await this.browser
      .from("buzzes")
      .select("round_id, player_id, server_ts")
      .eq("round_id", r.id)
      .order("server_ts", { ascending: true });
    (buzzes as BuzzRow[] | null)?.forEach((b) => this.handleBuzz(b));
  }

  private handleBuzz(b: BuzzRow): void {
    if (b.round_id !== this.currentRoundId) return;
    if (this.buzzQueue.some((x) => x.playerId === b.player_id)) return;

    this.buzzQueue.push({ playerId: b.player_id, serverTs: b.server_ts });
    this.buzzQueue.sort((a, c) => (a.serverTs < c.serverTs ? -1 : a.serverTs > c.serverTs ? 1 : 0));

    const queue: BuzzQueueEntry[] = this.buzzQueue.map((x, i) => ({
      playerId: x.playerId,
      rank: i + 1,
    }));
    const rank = queue.find((q) => q.playerId === b.player_id)?.rank ?? queue.length;

    this.dispatch("buzz_registered", { roundId: b.round_id, playerId: b.player_id, rank });
    this.dispatch("buzz_queue_updated", {
      roundId: b.round_id,
      queue,
      currentAnswererId: this.currentAnswererId ?? queue[0]?.playerId ?? null,
    });
  }

  private handleRoundUpdate(r: RoundUpdateRow): void {
    if (r.id !== this.currentRoundId) return;
    this.currentAnswererId = r.current_answerer_id;

    if (r.phase === "resolved") {
      this.dispatch("round_ended", {
        roundId: r.id,
        resolution: r.resolution ?? "skipped",
        winnerPlayerId: r.winner_player_id,
        revealedAnswer: {
          title: r.revealed_title ?? "",
          artist: r.revealed_artist ?? "",
          year: r.revealed_year,
        },
      });
      return;
    }

    const queue: BuzzQueueEntry[] = this.buzzQueue.map((x, i) => ({
      playerId: x.playerId,
      rank: i + 1,
    }));
    this.dispatch("buzz_queue_updated", {
      roundId: r.id,
      queue,
      currentAnswererId: this.currentAnswererId,
    });
  }

  private handleJudgement(j: JudgementRow): void {
    this.dispatch("answer_judged", {
      roundId: j.round_id,
      playerId: j.player_id,
      verdict: j.verdict,
      awardedPoints: j.awarded_points,
      nextAnswererId: null,
    });
    void this.emitScoreUpdate();
  }

  private async emitScoreUpdate(): Promise<void> {
    const { data } = await this.browser
      .from("players")
      .select("id, score, is_host")
      .eq("session_id", this.sessionId);
    const scores = ((data as { id: string; score: number; is_host: boolean }[] | null) ?? [])
      .filter((p) => !p.is_host)
      .map((p) => ({ playerId: p.id, total: p.score }));
    this.dispatch("score_updated", { scores });
  }
}
