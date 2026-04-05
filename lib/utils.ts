import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGpa(value: number | null) {
  return value == null ? "Unavailable" : value.toFixed(2);
}

export function formatPercent(value: number | null) {
  return value == null ? "Unavailable" : `${Math.round(value)}%`;
}

export function formatScore(value: number | null) {
  return value == null ? "Unavailable" : `${Math.round(value)}`;
}

export function scoreToLabel(score: number | null): string {
  if (score == null) return "Unavailable";
  if (score >= 80) return "Easy";
  if (score >= 65) return "Above avg";
  if (score >= 50) return "Average";
  if (score >= 35) return "Tough";
  return "Hard";
}

export function confidenceToLabel(confidence: number): string {
  if (confidence >= 75) return "High";
  if (confidence >= 50) return "Medium";
  return "Low";
}

export function formatConfidenceTone(value: string) {
  switch (value) {
    case "high":
    case "High":
      return "High confidence";
    case "medium":
    case "Medium":
      return "Medium confidence";
    case "low":
    case "Low":
      return "Limited confidence";
    default:
      return value;
  }
}

export function formatRating(value: number | null) {
  return value == null ? "Unavailable" : value.toFixed(1);
}

export function formatCoverageTier(tier: string) {
  switch (tier) {
    case "institutional_plus_rmp":
      return "High evidence";
    case "institutional_only":
      return "Official data";
    case "rmp_only":
      return "Limited evidence";
    default:
      return tier.replace(/_/g, " ");
  }
}

export function formatPlannerReadiness(value: string) {
  switch (value) {
    case "evidence_ready":
      return "Evidence-backed planning";
    case "schedule_ready":
      return "Schedule planner ready";
    case "catalog_ready":
      return "Course planner ready";
    case "directory_ready":
      return "School profile ready";
    default:
      return value.replace(/_/g, " ");
  }
}

export function formatProfessorCoverageLevel(value: string) {
  switch (value) {
    case "directory_only":
      return "Directory only";
    case "instructor_directory_ready":
      return "Instructor directory live";
    case "stats_partial":
      return "Stats expanding";
    case "stats_full":
      return "Institutional outcomes live";
    default:
      return value.replace(/_/g, " ");
  }
}

export function formatProfessorStatsAvailability(value: string) {
  switch (value) {
    case "none":
      return "Identity only";
    case "rmp_only":
      return "RMP signals";
    case "partial":
      return "Partial stats";
    case "full":
      return "Full stats";
    default:
      return value.replace(/_/g, " ");
  }
}

export function formatEvidenceSource(value: string) {
  switch (value) {
    case "official_grades":
      return "Official grades";
    case "schedule":
      return "Section schedule";
    case "catalog":
      return "Course catalog";
    case "rmp":
      return "RMP enrichment";
    case "community":
      return "Student submissions";
    case "syllabus":
      return "Syllabi";
    default:
      return value.replace(/_/g, " ");
  }
}

export function formatFreshnessLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  if (/^\d{4}-\d{2}-\d{2}(t.*)?$/i.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }

  return value;
}

export function formatSectionSchedule(
  days: string[] | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
) {
  const safeDays = days?.filter(Boolean) ?? [];
  if (!safeDays.length || !startTime || !endTime) {
    return "Time TBD";
  }

  return `${safeDays.join("")} ${startTime}-${endTime}`;
}

export function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatSignedDelta(
  value: number | null,
  formatter: (value: number) => string,
) {
  if (value == null) {
    return "Unavailable";
  }

  const prefix = value > 0 ? "+" : value < 0 ? "-" : "+/-";
  return `${prefix}${formatter(Math.abs(value))}`;
}
