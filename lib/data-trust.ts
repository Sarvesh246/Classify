import type { DataCompleteness, ProfessorCourseSummary } from "@/lib/types";

export const SMALL_SAMPLE_THRESHOLD = 40;

export function isSmallSample(sampleSize: number): boolean {
  return sampleSize < SMALL_SAMPLE_THRESHOLD;
}

function completenessLabel(c: DataCompleteness): string {
  switch (c) {
    case "institutional_full":
      return "Full institutional coverage";
    case "institutional_partial":
      return "Partial institutional coverage";
    case "rmp_only":
      return "Limited to reviews (RMP); grades incomplete";
    case "directory_only":
      return "Directory only";
    default:
      return "Mixed sources";
  }
}

/** One-line provenance for profile cards and grade panels. */
export function dataTrustSummaryLine(offering: ProfessorCourseSummary): string {
  const parts = [
    completenessLabel(offering.dataCompleteness),
    `n≈${offering.sampleSize}`,
    `latest ${offering.latestTerm}`,
    offering.freshness ? `updated ${offering.freshness}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Short note for estimated letter-mix charts (not official A–F buckets). */
export function estimatedChartCaption(): string {
  return "Letter bars are estimated from expected GPA and A-rate on this row—they are not separate official grade buckets.";
}
