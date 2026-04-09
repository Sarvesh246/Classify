import type { DataCompleteness, ProfessorCourseSummary } from "@/lib/types";

/** Human-readable note for RMP–institutional link quality (0–1 stored confidence). */
export function formatMatchConfidenceLine(matchConfidence: number): string | null {
  if (matchConfidence == null || Number.isNaN(matchConfidence) || matchConfidence <= 0) {
    return null;
  }
  const pct = Math.round(Math.max(0, Math.min(1, matchConfidence)) * 100);
  return `RMP match confidence about ${pct}%`;
}

/** Short ranking / planner context for offering cards. */
export function formatRankingContextNote(offering: ProfessorCourseSummary): string | null {
  if (offering.hasSectionPlanning) {
    return "Schedule timing available for planner-style ranking.";
  }
  switch (offering.rankingMode) {
    case "planner_fit":
      return "Ranked with planner-style weighting when schedule data exists.";
    case "ease_score":
      return "Rank emphasizes difficulty and workload signals.";
    default:
      return null;
  }
}

/** True when the row carries real institutional grade aggregates (not RMP-only). */
export function offeringHasInstitutionalGradeEvidence(offering: ProfessorCourseSummary): boolean {
  return (
    offering.dataCompleteness === "institutional_full" ||
    offering.dataCompleteness === "institutional_partial" ||
    offering.coverageTier === "institutional_only" ||
    offering.coverageTier === "institutional_plus_rmp"
  );
}

export const SMALL_SAMPLE_THRESHOLD = 40;

export function isSmallSample(sampleSize: number): boolean {
  return sampleSize < SMALL_SAMPLE_THRESHOLD;
}

function completenessLabel(c: DataCompleteness): string {
  switch (c) {
    case "institutional_full":
      return "Official grade evidence";
    case "institutional_partial":
      return "Partial official grade evidence";
    case "rmp_only":
      return "Limited evidence";
    case "directory_only":
      return "Directory baseline only";
    default:
      return "Mixed sources";
  }
}

/** One-line provenance for profile cards and grade panels. */
export function dataTrustSummaryLine(offering: ProfessorCourseSummary): string {
  const parts = [
    completenessLabel(offering.dataCompleteness),
    `n~${offering.sampleSize}`,
    `latest ${offering.latestTerm}`,
    offering.freshness ? `updated ${offering.freshness}` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

/** Short note for estimated letter-mix charts (not official A-F buckets). */
export function estimatedChartCaption(): string {
  return "Letter bars are estimated from expected GPA and A-rate on this row; they are not separate official grade buckets.";
}
