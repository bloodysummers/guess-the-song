/**
 * Shared domain types for Guess the Song.
 * Source of truth: docs/data-model.md
 */

export type SessionStatus = "lobby" | "active" | "finished";

export type RoundPhase = "playing" | "answering" | "resolved";

export type RoundResolution = "correct" | "exhausted" | "timeout" | "skipped";

export type Verdict = "correct" | "incorrect";

export type MusicProviderKind = "youtube" | "spotify";

/** Difficulty is expressed as the audio window length. */
export type AudioWindowMs = 15000 | 10000 | 5000 | 3000 | 1000;

export interface ExtraPointsConfig {
  artist: boolean;
  album: boolean;
  year: boolean;
}

/** How correct answers are scored. */
export type ScoringMode = "simple" | "speed";

export interface SessionConfig {
  /** "simple" = 1 point per correct answer; "speed" = base × difficulty × speed. */
  scoringMode: ScoringMode;
  audioWindowMs: number;
  /** Whether the next-fastest buzzer may answer after a wrong answer. */
  allowSteal: boolean;
  /** Points subtracted from a player who buzzes and answers wrong (0 = none). */
  wrongBuzzPenalty: number;
  extraPoints: ExtraPointsConfig;
}

/** Extras the host grants when judging. */
export type BonusFlags = Partial<ExtraPointsConfig>;

export interface PlayerPublic {
  id: string;
  displayName: string;
  isHost: boolean;
}

export interface ScoreEntry {
  playerId: string;
  total: number;
}

export interface PodiumEntry {
  playerId: string;
  displayName: string;
  total: number;
  position: number;
}

export interface BuzzQueueEntry {
  playerId: string;
  rank: number;
}

/**
 * Playable reference to a track. HOST-ONLY — never delivered to players,
 * to prevent looking up the answer.
 */
export interface TrackRef {
  provider: MusicProviderKind;
  providerRef: string;
  startMs: number;
}

/** Canonical answer + accepted aliases. HOST-ONLY (shown to the judge). */
export interface AnswerReference {
  title: string;
  artist: string;
  aliases: string[];
  year: number | null;
  album: string | null;
}

/** Answer revealed to everyone at round end (no track reference). */
export interface RevealedAnswer {
  title: string;
  artist: string;
  year: number | null;
}
