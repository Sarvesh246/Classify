import {
  type CoverageTier,
  type ProfessorCourseSummary,
  type ScoreBreakdownRow,
  type TrendPoint,
} from "@/lib/types";

const BASE_WEIGHTS = {
  avgGpa: 0.35,
  aPct: 0.35,
  rmpEase: 0.2,
  rmpQuality: 0.1,
} as const;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export interface ScoreInput {
  avgGpa: number | null;
  aPct: number | null;
  rmpDifficulty: number | null;
  rmpRating: number | null;
  coverageTier: CoverageTier;
  sampleSize: number;
  termCount: number;
}

type RawTrendPoint = Omit<TrendPoint, "classifyScore">;

type EnrichableSummary = Omit<
  ProfessorCourseSummary,
  "classifyScore" | "confidence" | "trendDelta" | "trend"
> & {
  trend: RawTrendPoint[];
};

export function getScoreBreakdown(
  input: Omit<ScoreInput, "sampleSize" | "termCount"> & { coverageTier?: CoverageTier },
) {
  const tier = input.coverageTier ?? "institutional_plus_rmp";
  /** Institutional-only rows have no RMP: do not re-scale grade weights to fill 0–100 (that falsely reads as "easy"). */
  const renormalizeMissing = tier !== "institutional_only";

  const rows: ScoreBreakdownRow[] = [
    {
      key: "avgGpa",
      label: "Expected GPA",
      value: input.avgGpa,
      normalized: input.avgGpa == null ? null : clamp(input.avgGpa / 4),
      baseWeight: BASE_WEIGHTS.avgGpa,
      effectiveWeight: 0,
      contribution: null,
    },
    {
      key: "aPct",
      label: "A / A- rate",
      value: input.aPct,
      normalized: input.aPct == null ? null : clamp(input.aPct / 100),
      baseWeight: BASE_WEIGHTS.aPct,
      effectiveWeight: 0,
      contribution: null,
    },
    {
      key: "rmpEase",
      label: "RMP ease signal",
      value: input.rmpDifficulty,
      normalized:
        input.rmpDifficulty == null ? null : clamp(1 - input.rmpDifficulty / 5),
      baseWeight: BASE_WEIGHTS.rmpEase,
      effectiveWeight: 0,
      contribution: null,
    },
    {
      key: "rmpQuality",
      label: "RMP quality signal",
      value: input.rmpRating,
      normalized: input.rmpRating == null ? null : clamp(input.rmpRating / 5),
      baseWeight: BASE_WEIGHTS.rmpQuality,
      effectiveWeight: 0,
      contribution: null,
    },
  ];

  const availableWeight = rows.reduce((sum, row) => {
    return row.normalized == null ? sum : sum + row.baseWeight;
  }, 0);

  return rows.map((row) => {
    if (row.normalized == null || availableWeight === 0) {
      return row;
    }

    if (!renormalizeMissing) {
      return {
        ...row,
        effectiveWeight: row.baseWeight,
        contribution: round(row.normalized * row.baseWeight * 100, 1),
      };
    }

    const effectiveWeight = row.baseWeight / availableWeight;
    return {
      ...row,
      effectiveWeight,
      contribution: round(row.normalized * effectiveWeight * 100, 1),
    };
  });
}

export function computeClassifyScore(input: ScoreInput) {
  const breakdown = getScoreBreakdown({
    avgGpa: input.avgGpa,
    aPct: input.aPct,
    rmpDifficulty: input.rmpDifficulty,
    rmpRating: input.rmpRating,
    coverageTier: input.coverageTier,
  });
  const available = breakdown.filter((row) => row.normalized != null);

  if (available.length === 0) {
    return null;
  }

  return round(
    available.reduce((sum, row) => sum + (row.contribution ?? 0), 0),
    1,
  );
}

export const computeClasslyScore = computeClassifyScore;

export function computeConfidence(input: ScoreInput) {
  const sampleFactor = clamp(input.sampleSize / 180);
  const termFactor = clamp(input.termCount / 6);
  const sourceFactor =
    input.coverageTier === "institutional_plus_rmp"
      ? 1
      : input.coverageTier === "institutional_only"
        ? 0.82
        : 0.58;

  return round(
    (sampleFactor * 0.45 + termFactor * 0.35 + sourceFactor * 0.2) * 100,
    0,
  );
}

export function computeTrendDelta(trend: TrendPoint[]) {
  const available = trend.filter((point) => point.classifyScore != null);

  if (available.length < 2) {
    return null;
  }

  return round(
    (available.at(-1)?.classifyScore ?? 0) - (available[0]?.classifyScore ?? 0),
    1,
  );
}

export function enrichSummary(summary: EnrichableSummary): ProfessorCourseSummary {
  const trend = summary.trend.map((point) => ({
    ...point,
    classifyScore: computeClassifyScore({
      avgGpa: point.avgGpa,
      aPct: point.aPct,
      rmpRating: point.rmpRating,
      rmpDifficulty: point.rmpDifficulty,
      coverageTier: summary.coverageTier,
      sampleSize: summary.sampleSize,
      termCount: summary.termCount,
    }),
  }));

  const classifyScore = computeClassifyScore({
    avgGpa: summary.expectedGpa,
    aPct: summary.aRate,
    rmpRating: summary.rmpRating,
    rmpDifficulty: summary.rmpDifficulty,
    coverageTier: summary.coverageTier,
    sampleSize: summary.sampleSize,
    termCount: summary.termCount,
  });

  return {
    ...summary,
    trend,
    classifyScore,
    confidence: computeConfidence({
      avgGpa: summary.expectedGpa,
      aPct: summary.aRate,
      rmpRating: summary.rmpRating,
      rmpDifficulty: summary.rmpDifficulty,
      coverageTier: summary.coverageTier,
      sampleSize: summary.sampleSize,
      termCount: summary.termCount,
    }),
    trendDelta: computeTrendDelta(trend),
  };
}
