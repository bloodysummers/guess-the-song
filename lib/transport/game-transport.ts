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
  GameSource,
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
}

export interface CreateSessionResult {
  sessionId: string;
  sessionCode: string;
  hostPlayerId: string;
  /** Token persisted by the client to reconnect as the same participant. */
  reconnectToken: string;
}

export interface CreateGameInput {
  /** Where the game's tracks come from (curated playlist or a YouTube URL). */
  source: GameSource;
  config: SessionConfig;
  roundsTotal?: number;
}

export interface CreateGameResult {
  gameId: string;
  /** Human-readable origin of the materialized track set. */
  sourceLabel?: string;
  /** How many tracks the source yielded. */
  trackCount?: number;
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

export interface ReplayInput {
  roundId: string;
}

export interface ReplaceTrackInput {
  roundId: string;
  /** Why the track failed, for the server log. */
  reason?: string;
}

export interface RefragmentInput {
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
  round_replayed: { roundId: string; replayCount: number };
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
  /** A new game started in the session. */
  game_started: { gameId: string; roundsTotal: number; config: SessionConfig };
  /** Current game's scoreboard and the session's cumulative totals. */
  score_updated: { gameScores: ScoreEntry[]; sessionTotals: ScoreEntry[] };
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
  /** Host starts a new game within the session. */
  createGame(input: CreateGameInput): Promise<CreateGameResult>;
  /** Host ends the current game (returns the session to the hub). */
  endGame(): Promise<Ack>;
  /** Host closes the session for everyone. */
  closeSession(): Promise<Ack>;
  startRound(): Promise<StartRoundResult>;
  buzz(input: BuzzInput): Promise<Ack>;
  /** Host replays the audio window before any buzz (applies a scoring penalty). */
  replayRound(input: ReplayInput): Promise<Ack>;
  /**
   * The track could not be played at all. Swaps in another track for the SAME round
   * (no round is consumed) and re-emits `round_host_payload` with it.
   */
  replaceRoundTrack(input: ReplaceTrackInput): Promise<Ack>;
  /**
   * Host plays a different random fragment of the same track, with NO penalty — the
   * escape hatch for a fragment that is silent or unguessable. Later penalized
   * replays then apply to this new fragment.
   */
  refragmentRound(input: RefragmentInput): Promise<Ack>;
  judge(input: JudgeInput): Promise<Ack>;
  nextRound(): Promise<StartRoundResult>;
  leave(): Promise<Ack>;

  // Event subscription
  on<E extends GameEventName>(event: E, handler: GameEventHandler<E>): void;
  off<E extends GameEventName>(event: E, handler: GameEventHandler<E>): void;

  // Presence / lifecycle
  presence(): Promise<string[]>;
  disconnect(): Promise<void>;
}
