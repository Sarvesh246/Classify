import { professorLastNameSortKey } from "@/lib/professor-sort";
import type { ProfessorCourseSummary } from "@/lib/types";

export type OfferingSortKey =
  | "name"
  | "classify"
  | "gpa"
  | "arate"
  | "trend"
  | "rating";

export const offeringSorters: Record<
  Exclude<OfferingSortKey, "name">,
  (item: ProfessorCourseSummary) => number
> = {
  classify: (item) => item.classifyScore ?? -1,
  gpa: (item) => item.expectedGpa ?? -1,
  arate: (item) => item.aRate ?? -1,
  trend: (item) => item.trendDelta ?? -999,
  rating: (item) => item.rmpRating ?? -1,
};

export function compareOfferings(
  left: ProfessorCourseSummary,
  right: ProfessorCourseSummary,
  key: OfferingSortKey,
): number {
  if (key === "name") {
    const c = professorLastNameSortKey(left.professorName).localeCompare(
      professorLastNameSortKey(right.professorName),
      undefined,
      { sensitivity: "base" },
    );
    if (c !== 0) return c;
    return left.professorName.localeCompare(right.professorName, undefined, {
      sensitivity: "base",
    });
  }
  return offeringSorters[key](right) - offeringSorters[key](left);
}

export const offeringSortLabels: Array<{ key: OfferingSortKey; label: string }> = [
  { key: "name", label: "A–Z (last name)" },
  { key: "classify", label: "Best overall" },
  { key: "gpa", label: "Highest GPA" },
  { key: "arate", label: "Most A's" },
  { key: "trend", label: "Easiest trend lately" },
  { key: "rating", label: "Best rated" },
];
