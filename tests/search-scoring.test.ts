import { describe, expect, it } from "vitest";
import {
  exactCourseCodeBoost,
  fuzzyTokenBonus,
  levenshteinWithin,
  scoreMatch,
} from "@/lib/search-scoring";

describe("levenshteinWithin", () => {
  it("returns distance within bound", () => {
    expect(levenshteinWithin("venkat", "venkataraman", 3)).toBeNull();
    expect(levenshteinWithin("venkat", "venkata", 2)).toBe(1);
    expect(levenshteinWithin("abc", "abc", 0)).toBe(0);
  });
});

describe("fuzzyTokenBonus", () => {
  it("adds bonus for close typo vs haystack word", () => {
    const { bonus, matched } = fuzzyTokenBonus(
      "daniel parkx",
      "Daniel Park Utah Austin CS",
    );
    expect(matched).toBe(true);
    expect(bonus).toBeGreaterThan(0);
  });
});

describe("exactCourseCodeBoost", () => {
  it("boosts exact key match", () => {
    expect(exactCourseCodeBoost("FINC422", "FINC422", "course")).toBe(120);
    expect(exactCourseCodeBoost("FINC422", "FINC422", "professor")).toBe(88);
  });
});

describe("scoreMatch", () => {
  it("matches start and contains", () => {
    expect(scoreMatch("finc", "FINC 422 - Finance", [])).toBeGreaterThan(70);
  });
});
