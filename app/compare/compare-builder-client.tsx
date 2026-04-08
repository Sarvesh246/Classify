"use client";

import dynamic from "next/dynamic";
import { ClassifyLoadingMark } from "@/components/loading/classify-loading-mark";
import type { ProfessorCourseSummary } from "@/lib/types";

const CompareBuilder = dynamic(
  () =>
    import("@/components/compare/compare-builder").then((m) => m.CompareBuilder),
  {
    ssr: false,
    loading: () => (
      <div
        aria-busy="true"
        className="classify-inner-soft flex min-h-[min(56vh,480px)] flex-col items-center justify-center rounded-[30px] py-16"
      >
        <ClassifyLoadingMark size="lg" tone="light" label="Loading compare builder" />
      </div>
    ),
  },
);

export function CompareBuilderClient({
  catalog,
  initialSelectedIds,
  initialSchoolSlug,
}: {
  catalog: ProfessorCourseSummary[];
  initialSelectedIds: string[];
  initialSchoolSlug?: string;
}) {
  return (
    <CompareBuilder
      catalog={catalog}
      initialSelectedIds={initialSelectedIds}
      initialSchoolSlug={initialSchoolSlug}
    />
  );
}
