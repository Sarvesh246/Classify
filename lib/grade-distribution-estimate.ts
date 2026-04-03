import type { GradeDistributionBucket } from "@/lib/types";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function bucketsFromReportedAOnly(safeSample: number, aShare: number): GradeDistributionBucket[] {
  const aPct = round(clamp(aShare, 0, 100), 1);
  const aCount =
    aPct >= 99.99 ? safeSample : Math.min(safeSample, Math.round((aPct / 100) * safeSample));
  const perZero: GradeDistributionBucket[] = (["B", "C", "D", "F"] as const).map((grade) => ({
    grade,
    count: 0,
    pct: 0,
  }));
  return [{ grade: "A", count: aCount, pct: aPct }, ...perZero];
}

/**
 * Same model as catalog term-level series: headline GPA + A-rate only.
 * When stats are nearly all A's, non-A buckets stay at 0 (no invented 5% D bar).
 */
export function estimateGradeBuckets(
  sampleSize: number,
  avgGpa: number | null,
  aRate: number | null,
): GradeDistributionBucket[] {
  const safeSample = Math.max(sampleSize, 12);
  if (aRate == null && avgGpa == null) {
    return (["A", "B", "C", "D", "F"] as const).map((grade) => ({
      grade,
      count: 0,
      pct: 0,
    }));
  }

  const aShare = clamp(aRate ?? 0, 0, 100);
  let remaining = Math.max(0, 100 - aShare);

  const nearAllAs = avgGpa != null && avgGpa >= 3.97 && aShare >= 99;

  if (remaining <= 0.05 || nearAllAs) {
    return bucketsFromReportedAOnly(safeSample, aShare);
  }

  const aPct = aShare;
  remaining = Math.max(0, 100 - aPct);
  if (remaining <= 0.05) {
    return bucketsFromReportedAOnly(safeSample, aPct);
  }

  const rigor = avgGpa == null ? 0.65 : clamp((4 - avgGpa) / 2.8, 0.15, 1);

  const rawB = remaining * clamp(0.54 - rigor * 0.16, 0.18, 0.62);
  const rawC = remaining * clamp(0.28 + rigor * 0.08, 0.16, 0.42);
  const rawD = remaining * clamp(0.11 + rigor * 0.04, 0.06, 0.2);
  const rawF = Math.max(remaining - rawB - rawC - rawD, remaining * 0.04);
  const rawTotal = aPct + rawB + rawC + rawD + rawF;

  const normalized = {
    A: (aPct / rawTotal) * 100,
    B: (rawB / rawTotal) * 100,
    C: (rawC / rawTotal) * 100,
    D: (rawD / rawTotal) * 100,
    F: (rawF / rawTotal) * 100,
  };

  const grades = ["A", "B", "C", "D", "F"] as const;
  let assigned = 0;

  return grades.map((grade, index) => {
    const pct = round(normalized[grade], 1);
    const count =
      index === grades.length - 1
        ? Math.max(safeSample - assigned, 0)
        : Math.round((pct / 100) * safeSample);
    assigned += count;

    return {
      grade,
      count,
      pct,
    };
  });
}

/** Profile chart uses aggregated offering headline stats — same inputs as classify GPA/A-rate. */
export function estimatedMixForOfferingSummary(input: {
  sampleSize: number;
  expectedGpa: number | null;
  aRate: number | null;
}): GradeDistributionBucket[] {
  return estimateGradeBuckets(input.sampleSize, input.expectedGpa, input.aRate);
}
