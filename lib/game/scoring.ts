/**
 * Scoring engine — a pure function so it can be unit-tested in isolation.
 * Source of truth: docs/data-model.md §6.
 */

import type { ScoringMode } from "./types";

const BASE = 100;
const SPEED_FLOOR = 0.1;

const DIFFICULTY_MULTIPLIER: Record<number, number> = {
  15000: 1.0,
  10000: 1.25,
  5000: 1.5,
  3000: 2.0,
  1000: 3.0,
};

export function difficultyMultiplier(audioWindowMs: number): number {
  return DIFFICULTY_MULTIPLIER[audioWindowMs] ?? 1;
}

export interface AwardInput {
  mode: ScoringMode;
  audioWindowMs: number;
  /** Time from round start to the winning buzz (server-sealed). */
  timeToBuzzMs: number;
  /** Extra points granted (artist/album/year); 0 by default. */
  extras?: number;
}

/** Points awarded for a correct answer. */
export function computeAward(input: AwardInput): number {
  if (input.mode === "simple") {
    return 1;
  }
  const raw = 1 - input.timeToBuzzMs / input.audioWindowMs;
  const speedFactor = Math.min(1, Math.max(SPEED_FLOOR, raw));
  const extras = input.extras ?? 0;
  return Math.round(BASE * difficultyMultiplier(input.audioWindowMs) * speedFactor) + extras;
}
