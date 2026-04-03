import type { ProfessorCourseSummary } from "@/lib/types";

export type OfferingSortKey = "classify" | "gpa" | "arate" | "trend" | "rating";

export const offeringSorters: Record<
  OfferingSortKey,
  (item: ProfessorCourseSummary) => number
> = {
  classify: (item) => item.classifyScore ?? -1,
  gpa: (item) => item.expectedGpa ?? -1,
  arate: (item) => item.aRate ?? -1,
  trend: (item) => item.trendDelta ?? -999,
  rating: (item) => item.rmpRating ?? -1,
};

export const offeringSortLabels: Array<{ key: OfferingSortKey; label: string }> = [
  { key: "classify", label: "Best overall" },
  { key: "gpa", label: "Highest GPA" },
  { key: "arate", label: "Most A's" },
  { key: "trend", label: "Easiest trend lately" },
  { key: "rating", label: "Best rated" },
];
