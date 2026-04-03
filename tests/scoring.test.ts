import { describe, expect, it } from "vitest";
import { computeClassifyScore } from "../lib/scoring";

describe("computeClassifyScore", () => {
  it("computes a score with all signals", () => {
    const score = computeClassifyScore({
      avgGpa: 3.6,
      aPct: 70,
      rmpDifficulty: 2,
      rmpRating: 4.5,
      coverageTier: "institutional_plus_rmp",
      sampleSize: 200,
      termCount: 6,
    });

    expect(score).toBeCloseTo(77, 1);
  });

  it("renormalizes when grade data is missing", () => {
    const score = computeClassifyScore({
      avgGpa: null,
      aPct: null,
      rmpDifficulty: 3,
      rmpRating: 4,
      coverageTier: "rmp_only",
      sampleSize: 100,
      termCount: 1,
    });

    expect(score).toBeCloseTo(53.3, 0);
  });

  it("caps institutional-only scores so grade-only rows cannot hit 100", () => {
    const score = computeClassifyScore({
      avgGpa: 4.0,
      aPct: 100,
      rmpDifficulty: null,
      rmpRating: null,
      coverageTier: "institutional_only",
      sampleSize: 50,
      termCount: 1,
    });

    expect(score).toBe(70);
  });
});
