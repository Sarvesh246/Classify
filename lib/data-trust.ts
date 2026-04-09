import type { DataCompleteness, ProfessorCourseSummary } from "@/lib/types";

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
