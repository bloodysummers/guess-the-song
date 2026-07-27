/**
 * SupabaseTransport — implementation of GameTransport.
 *
 * The ONLY module tree allowed to import the Supabase SDK. Mutations go through
 * server Route Handlers (service role); reads and presence use the browser anon
 * client over Realtime.
 *
 * Session = persistent hub (players/host). Game = a playthrough inside a session.
 * Round/buzz/judgement Realtime is filtered by session_id (stable key) and scoped
 * to the current game_id / round_id on the client.
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
  type CreateGameInput,
  type CreateGameResult,
  type CreateSessionInput,
  type CreateSessionResult,
  type GameEventHandler,
  type GameEventMap,
  type GameEventName,
  type GameTransport,
  type JoinSessionInput,
  type JoinSessionResult,
  type JudgeInput,
  type RefragmentInput,
  type ReplaceTrackInput,
  type ReplayInput,
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

interface GameRow {
  id: string;
  config: SessionConfig;
  rounds_total: number;
  status: string;
  current_round_id: string | null;
}

interface RoundRow {
  id: string;
  game_id: string;
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
  revealed_artwork_url: string | null;
  replay_count: number;
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

export class SupabaseTransport implements GameTransport {
  private readonly browser: SupabaseClient;
  private readonly handlers = new Map<GameEventName, Set<GameEventHandler<GameEventName>>>();

  private sessionId: string | null = null;
  private playerId: string | null = null;
  private reconnectToken: string | null = null;
  private isHost = false;
  private channel: RealtimeChannel | null = null;

  private currentGameId: string | null = null;
  private currentRoundId: string | null = null;
  private currentAnswererId: string | null = null;
  private currentReplayCount = 0;
  private buzzQueue: { playerId: string; serverTs: string }[] = [];

  constructor(client?: SupabaseClient) {
    this.browser = client ?? getSupabaseBrowser();
  }

  // --- Session actions ----------------------------------------------------

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const result = await postJson<CreateSessionResult>("/api/sessions", {
      hostName: input.hostName,
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

  async closeSession(): Promise<Ack> {
    await postJson("/api/sessions/close", {
      sessionId: this.sessionId,
      playerId: this.playerId,
      reconnectToken: this.reconnectToken,
    });
    return { ok: true };
  }

  async presence(): Promise<string[]> {
    if (!this.channel) return [];
    return Object.keys(this.channel.presenceState());
  }

  // --- Game actions -------------------------------------------------------

  async createGame(input: CreateGameInput): Promise<CreateGameResult> {
    const result = await postJson<CreateGameResult>("/api/games", {
      sessionId: this.sessionId,
      playerId: this.playerId,
      reconnectToken: this.reconnectToken,
      source: input.source,
      config: input.config,
      roundsTotal: input.roundsTotal,
    });
    // Apply eagerly so the host transitions immediately (the Realtime games INSERT
    // will re-dispatch game_started for everyone; it is idempotent).
    this.currentGameId = result.gameId;
    this.resetRoundState();
    this.dispatch("game_started", {
      gameId: result.gameId,
      roundsTotal: input.roundsTotal ?? 10,
      config: input.config,
    });
    return result;
  }

  async endGame(): Promise<Ack> {
    if (this.currentGameId) {
      await postJson(`/api/games/${this.currentGameId}/end`, {
        sessionId: this.sessionId,
        playerId: this.playerId,
        reconnectToken: this.reconnectToken,
      }).catch(() => undefined);
    }
    return { ok: true };
  }

  // --- Round & buzzer actions ---------------------------------------------

  async startRound(): Promise<StartRoundResult> {
    if (!this.currentGameId) throw new TransportError("no_active_game", 409);
    const res = await postJson<StartRoundHostResult & { gameOver?: boolean }>(
      `/api/games/${this.currentGameId}/rounds`,
      {
        sessionId: this.sessionId,
        playerId: this.playerId,
        reconnectToken: this.reconnectToken,
      },
    );
    if (res.gameOver) {
      // The game ended; the games UPDATE (finished) drives the podium.
      return { roundId: "" };
    }
    this.dispatch("round_host_payload", {
      roundId: res.roundId,
      audioWindowMs: res.audioWindowMs,
      track: res.track,
      answer: res.answer,
    });
    return { roundId: res.roundId };
  }

  nextRound(): Promise<StartRoundResult> {
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

  async replayRound(input: ReplayInput): Promise<Ack> {
    await postJson(`/api/rounds/${input.roundId}/replay`, {
      sessionId: this.sessionId,
      playerId: this.playerId,
      reconnectToken: this.reconnectToken,
    });
    return { ok: true };
  }

  async replaceRoundTrack(input: ReplaceTrackInput): Promise<Ack> {
    const res = await postJson<StartRoundHostResult>(
      `/api/rounds/${input.roundId}/replace-track`,
      {
        sessionId: this.sessionId,
        playerId: this.playerId,
        reconnectToken: this.reconnectToken,
        reason: input.reason,
      },
    );
    // Same event as a fresh round: the host device just plays whatever it is handed.
    this.dispatch("round_host_payload", {
      roundId: input.roundId,
      audioWindowMs: res.audioWindowMs,
      track: res.track,
      answer: res.answer,
    });
    return { ok: true };
  }

  async refragmentRound(input: RefragmentInput): Promise<Ack> {
    await postJson(`/api/rounds/${input.roundId}/refragment`, {
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
    // Event handlers are intentionally kept (they are the UI's subscriptions).
    this.sessionId = null;
    this.playerId = null;
    this.reconnectToken = null;
    this.isHost = false;
    this.currentGameId = null;
    this.currentRoundId = null;
    this.currentAnswererId = null;
    this.currentReplayCount = 0;
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

  private resetRoundState(): void {
    this.currentRoundId = null;
    this.currentAnswererId = null;
    this.currentReplayCount = 0;
    this.buzzQueue = [];
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
      (payload) => this.dispatch("player_joined", { player: toPublic(payload.new as PlayerRow) }),
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
        const s = payload.new as { status: SessionStatus };
        this.dispatch("session_updated", { status: s.status });
      },
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "games", filter: `session_id=eq.${sessionId}` },
      (payload) => this.handleGameStarted(payload.new as GameRow),
    );

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "games", filter: `session_id=eq.${sessionId}` },
      (payload) => {
        const g = payload.new as GameRow;
        if (g.id === this.currentGameId && g.status === "finished") {
          void this.emitGameEnded(g.id);
        }
      },
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "rounds", filter: `session_id=eq.${sessionId}` },
      (payload) => {
        const r = payload.new as RoundRow;
        if (r.game_id !== this.currentGameId) return;
        this.resetRoundState();
        this.currentRoundId = r.id;
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
      { event: "INSERT", schema: "public", table: "judgements", filter: `session_id=eq.${sessionId}` },
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
    await this.emitSession();
    await this.emitCurrentGame();
  }

  private handleGameStarted(g: GameRow): void {
    if (g.status !== "active") return;
    this.currentGameId = g.id;
    this.resetRoundState();
    this.dispatch("game_started", {
      gameId: g.id,
      roundsTotal: g.rounds_total,
      config: g.config,
    });
    void this.emitScoreUpdate();
  }

  private async emitSession(): Promise<void> {
    const { data } = await this.browser
      .from("sessions")
      .select("status")
      .eq("id", this.sessionId)
      .maybeSingle();
    const s = data as { status: SessionStatus } | null;
    if (s) this.dispatch("session_updated", { status: s.status });
  }

  /** On (re)connect, replay the active game + round (if any) and the scores. */
  private async emitCurrentGame(): Promise<void> {
    const { data } = await this.browser
      .from("games")
      .select("id, config, rounds_total, status, current_round_id")
      .eq("session_id", this.sessionId)
      .order("created_at", { ascending: false })
      .limit(1);
    const game = (data as GameRow[] | null)?.[0];

    if (!game || game.status !== "active") {
      await this.emitScoreUpdate();
      return;
    }

    this.handleGameStarted(game);
    if (game.current_round_id) await this.emitCurrentRound(game.current_round_id);
  }

  private async emitGameEnded(gameId: string): Promise<void> {
    const { data: gs } = await this.browser
      .from("game_scores")
      .select("player_id, score")
      .eq("game_id", gameId);
    const { data: players } = await this.browser
      .from("players")
      .select("id, display_name")
      .eq("session_id", this.sessionId);
    const names = new Map(
      ((players as { id: string; display_name: string }[] | null) ?? []).map((p) => [
        p.id,
        p.display_name,
      ]),
    );
    const podium = ((gs as { player_id: string; score: number }[] | null) ?? [])
      .map((r) => ({ playerId: r.player_id, displayName: names.get(r.player_id) ?? "—", total: r.score }))
      .sort((a, b) => b.total - a.total)
      .map((p, i) => ({ ...p, position: i + 1 }));
    this.dispatch("game_ended", { podium });
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

  private async emitCurrentRound(roundId: string): Promise<void> {
    const { data: round } = await this.browser
      .from("rounds")
      .select("id, round_number, audio_window_ms, phase, current_answerer_id, replay_count")
      .eq("id", roundId)
      .maybeSingle();
    const r = round as
      | (RoundRow & { current_answerer_id: string | null; replay_count: number })
      | null;
    if (!r || r.phase === "resolved") return;

    this.resetRoundState();
    this.currentRoundId = r.id;
    this.currentAnswererId = r.current_answerer_id;
    this.currentReplayCount = r.replay_count;
    this.dispatch("round_started", {
      roundId: r.id,
      roundNumber: r.round_number,
      audioWindowMs: r.audio_window_ms,
      buzzEnabled: true,
    });
    if (r.replay_count > 0) {
      this.dispatch("round_replayed", { roundId: r.id, replayCount: r.replay_count });
    }

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

    const queue: BuzzQueueEntry[] = this.buzzQueue.map((x, i) => ({ playerId: x.playerId, rank: i + 1 }));
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

    if (r.replay_count > this.currentReplayCount) {
      this.currentReplayCount = r.replay_count;
      this.dispatch("round_replayed", { roundId: r.id, replayCount: r.replay_count });
    }

    if (r.phase === "resolved") {
      this.dispatch("round_ended", {
        roundId: r.id,
        resolution: r.resolution ?? "skipped",
        winnerPlayerId: r.winner_player_id,
        revealedAnswer: {
          title: r.revealed_title ?? "",
          artist: r.revealed_artist ?? "",
          year: r.revealed_year,
          artworkUrl: r.revealed_artwork_url,
        },
      });
      return;
    }

    const queue: BuzzQueueEntry[] = this.buzzQueue.map((x, i) => ({ playerId: x.playerId, rank: i + 1 }));
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
    let gameScores: { playerId: string; total: number }[] = [];
    if (this.currentGameId) {
      const { data } = await this.browser
        .from("game_scores")
        .select("player_id, score")
        .eq("game_id", this.currentGameId);
      gameScores = ((data as { player_id: string; score: number }[] | null) ?? []).map((r) => ({
        playerId: r.player_id,
        total: r.score,
      }));
    }

    // Session cumulative: sum of game_scores across all of the session's games.
    const { data: games } = await this.browser
      .from("games")
      .select("id")
      .eq("session_id", this.sessionId);
    const gameIds = ((games as { id: string }[] | null) ?? []).map((g) => g.id);
    let sessionTotals: { playerId: string; total: number }[] = [];
    if (gameIds.length) {
      const { data: all } = await this.browser
        .from("game_scores")
        .select("player_id, score")
        .in("game_id", gameIds);
      const m = new Map<string, number>();
      ((all as { player_id: string; score: number }[] | null) ?? []).forEach((r) => {
        m.set(r.player_id, (m.get(r.player_id) ?? 0) + r.score);
      });
      sessionTotals = [...m.entries()].map(([playerId, total]) => ({ playerId, total }));
    }

    this.dispatch("score_updated", { gameScores, sessionTotals });
  }
}
