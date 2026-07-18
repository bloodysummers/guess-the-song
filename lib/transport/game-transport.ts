/**
 * GameTransport — the single abstraction through which game logic and UI talk
 * to the backend. Provider SDKs (e.g. @supabase/*) MUST NOT be imported outside
 * a concrete implementation of this interface.
 *
 * Source of truth: docs/data-model.md §4 (contract) and §5 (visibility rules).
 */

import type {
  AnswerReference,
  BonusFlags,
  BuzzQueueEntry,
  PlayerPublic,
  PodiumEntry,
  RevealedAnswer,
  RoundResolution,
  ScoreEntry,
  SessionConfig,
  SessionStatus,
  TrackRef,
  Verdict,
} from "@/lib/game/types";

/* ------------------------------------------------------------------ */
/* Actions: client → server                                            */
/* ------------------------------------------------------------------ */

export interface Ack {
  ok: boolean;
}

/** Error thrown by a transport when an action fails; `code` is a stable slug. */
export class TransportError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 0) {
    super(code);
    this.name = "TransportError";
    this.code = code;
    this.status = status;
  }
}

export interface CreateSessionInput {
  hostName: string;
  playlistId: string;
  config: SessionConfig;
  roundsTotal?: number;
}

export interface CreateSessionResult {
  sessionId: string;
  sessionCode: string;
  hostPlayerId: string;
  /** Token persisted by the client to reconnect as the same participant. */
  reconnectToken: string;
}

export interface JoinSessionInput {
  code: string;
  displayName: string;
}

export interface JoinSessionResult {
  sessionId: string;
  playerId: string;
  /** Token persisted by the client to reconnect as the same participant. */
  reconnectToken: string;
}

export interface ResumeInput {
  sessionId: string;
  playerId: string;
  reconnectToken: string;
}

export interface ResumeResult {
  ok: boolean;
  playerId: string;
  isHost: boolean;
  displayName: string;
}

export interface StartRoundResult {
  roundId: string;
}

export interface BuzzInput {
  roundId: string;
}

export interface JudgeInput {
  roundId: string;
  playerId: string;
  verdict: Verdict;
  bonusFlags?: BonusFlags;
}

/* ------------------------------------------------------------------ */
/* Events: server → client                                             */
/* ------------------------------------------------------------------ */

export interface GameEventMap {
  session_updated: {
    status: SessionStatus;
    config: SessionConfig;
    roundsTotal: number;
    currentRoundNumber: number | null;
  };
  player_joined: { player: PlayerPublic };
  player_left: { playerId: string };
  presence_updated: { onlinePlayerIds: string[] };

  /**
   * Delivered to PLAYERS. Deliberately excludes any track reference or answer
   * so players cannot look up the song. See HOST_ONLY_EVENTS for the host data.
   */
  round_started: {
    roundId: string;
    roundNumber: number;
    audioWindowMs: number;
    buzzEnabled: true;
  };

  /** HOST-ONLY. Carries the playable track reference, audio window, and the answer. */
  round_host_payload: {
    roundId: string;
    audioWindowMs: number;
    track: TrackRef;
    answer: AnswerReference;
  };

  /** HOST-ONLY. Instructs the host device to play/stop via MusicProvider. */
  music_control: { action: "play" | "stop"; atMs: number };

  buzz_registered: { roundId: string; playerId: string; rank: number };
  buzz_queue_updated: {
    roundId: string;
    queue: BuzzQueueEntry[];
    currentAnswererId: string | null;
  };
  answer_judged: {
    roundId: string;
    playerId: string;
    verdict: Verdict;
    awardedPoints: number;
    nextAnswererId: string | null;
  };
  round_ended: {
    roundId: string;
    resolution: RoundResolution;
    winnerPlayerId: string | null;
    revealedAnswer: RevealedAnswer;
  };
  score_updated: { scores: ScoreEntry[] };
  game_ended: { podium: PodiumEntry[] };
  error: { code: string; message: string };
}

export type GameEventName = keyof GameEventMap;

/**
 * Events that carry sensitive data (track reference or answer). A conforming
 * transport MUST route these only to the session host, never to players.
 */
export const HOST_ONLY_EVENTS = ["round_host_payload", "music_control"] as const;

export type HostOnlyEvent = (typeof HOST_ONLY_EVENTS)[number];

export type GameEventHandler<E extends GameEventName> = (payload: GameEventMap[E]) => void;

/* ------------------------------------------------------------------ */
/* The transport interface                                             */
/* ------------------------------------------------------------------ */

export interface GameTransport {
  // Actions
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  joinSession(input: JoinSessionInput): Promise<JoinSessionResult>;
  /** Rejoin an active session with a stored identity (reconnection). */
  resume(input: ResumeInput): Promise<ResumeResult>;
  startRound(): Promise<StartRoundResult>;
  buzz(input: BuzzInput): Promise<Ack>;
  judge(input: JudgeInput): Promise<Ack>;
  nextRound(): Promise<StartRoundResult>;
  endGame(): Promise<Ack>;
  /** Host restarts the game with the same players (scores reset, back to lobby). */
  restart(): Promise<Ack>;
  leave(): Promise<Ack>;

  // Event subscription
  on<E extends GameEventName>(event: E, handler: GameEventHandler<E>): void;
  off<E extends GameEventName>(event: E, handler: GameEventHandler<E>): void;

  // Presence / lifecycle
  presence(): Promise<string[]>;
  disconnect(): Promise<void>;
}
