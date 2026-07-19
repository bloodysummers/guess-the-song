import { describe, expect, it } from "vitest";

import { computeAward } from "./scoring";

describe("computeAward", () => {
  it("simple mode awards the base (10) regardless of speed/difficulty", () => {
    expect(computeAward({ mode: "simple", audioWindowMs: 5000, timeToBuzzMs: 100 })).toBe(10);
    expect(computeAward({ mode: "simple", audioWindowMs: 1000, timeToBuzzMs: 4000 })).toBe(10);
  });

  it("modifier scales the award (penalty and boost)", () => {
    expect(computeAward({ mode: "simple", audioWindowMs: 5000, timeToBuzzMs: 0, modifier: 0.5 })).toBe(
      5,
    );
    expect(computeAward({ mode: "simple", audioWindowMs: 5000, timeToBuzzMs: 0, modifier: 2 })).toBe(
      20,
    );
    // Default modifier leaves the award unchanged.
    const base = computeAward({ mode: "speed", audioWindowMs: 5000, timeToBuzzMs: 0 });
    const withDefault = computeAward({
      mode: "speed",
      audioWindowMs: 5000,
      timeToBuzzMs: 0,
      modifier: 1,
    });
    expect(withDefault).toBe(base);
  });

  it("speed: a faster buzz scores higher than a slower one", () => {
    const fast = computeAward({ mode: "speed", audioWindowMs: 10000, timeToBuzzMs: 1000 });
    const slow = computeAward({ mode: "speed", audioWindowMs: 10000, timeToBuzzMs: 8000 });
    expect(fast).toBeGreaterThan(slow);
  });

  it("speed: a shorter audio window scores higher at the same speed", () => {
    const shortWindow = computeAward({ mode: "speed", audioWindowMs: 3000, timeToBuzzMs: 0 });
    const longWindow = computeAward({ mode: "speed", audioWindowMs: 15000, timeToBuzzMs: 0 });
    expect(shortWindow).toBeGreaterThan(longWindow);
  });

  it("speed: a very late buzz still scores above zero (floor)", () => {
    const late = computeAward({ mode: "speed", audioWindowMs: 5000, timeToBuzzMs: 999999 });
    expect(late).toBeGreaterThan(0);
  });

  it("speed: extras are added on top", () => {
    const withoutExtras = computeAward({ mode: "speed", audioWindowMs: 5000, timeToBuzzMs: 0 });
    const withExtras = computeAward({
      mode: "speed",
      audioWindowMs: 5000,
      timeToBuzzMs: 0,
      extras: 25,
    });
    expect(withExtras).toBe(withoutExtras + 25);
  });
});
