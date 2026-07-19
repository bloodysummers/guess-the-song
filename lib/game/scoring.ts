/**
 * Scoring engine — a pure function so it can be unit-tested in isolation.
 * Source of truth: docs/data-model.md §6.
 */

import type { ScoringMode } from "./types";

const BASE = 100;
const BASE_SIMPLE = 10;
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
  /** Multiplicative modifier for penalties (< 1) or boosts (> 1); 1 by default. */
  modifier?: number;
}

function speedFactor(audioWindowMs: number, timeToBuzzMs: number): number {
  const raw = 1 - timeToBuzzMs / audioWindowMs;
  return Math.min(1, Math.max(SPEED_FLOOR, raw));
}

/** Points awarded for a correct answer. */
export function computeAward(input: AwardInput): number {
  const modifier = input.modifier ?? 1;
  const extras = input.extras ?? 0;
  const base =
    input.mode === "simple"
      ? BASE_SIMPLE
      : BASE *
        difficultyMultiplier(input.audioWindowMs) *
        speedFactor(input.audioWindowMs, input.timeToBuzzMs);
  return Math.round(base * modifier) + extras;
}
