import { describe, expect, it } from "vitest";
import { estimatedMixForOfferingSummary } from "@/lib/grade-distribution-estimate";

describe("estimatedMixForOfferingSummary", () => {
  it("does not invent D/F when A-rate is 100% and GPA is ~4.0", () => {
    const buckets = estimatedMixForOfferingSummary({
      sampleSize: 19,
      expectedGpa: 4.0,
      aRate: 100,
    });
    const d = buckets.find((b) => b.grade === "D");
    const f = buckets.find((b) => b.grade === "F");
    expect(d?.pct ?? 0).toBe(0);
    expect(f?.pct ?? 0).toBe(0);
    const a = buckets.find((b) => b.grade === "A");
    expect(a?.pct).toBe(100);
  });

  it("sums letter percentages to ~100 for mixed GPA", () => {
    const buckets = estimatedMixForOfferingSummary({
      sampleSize: 120,
      expectedGpa: 3.2,
      aRate: 45,
    });
    const sum = buckets.reduce((s, b) => s + b.pct, 0);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThanOrEqual(100.2);
  });
});
