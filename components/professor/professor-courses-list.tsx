"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  compareOfferings,
  offeringSortLabels,
  type OfferingSortKey,
} from "@/lib/offering-sort";
import type { ProfessorCourseSummary } from "@/lib/types";
import { cn, formatScore, scoreToLabel } from "@/lib/utils";

export function ProfessorCoursesList({
  offerings,
  schoolSlug,
}: {
  offerings: ProfessorCourseSummary[];
  schoolSlug: string;
}) {
  const [sort, setSort] = useState<OfferingSortKey>("name");
  const sorted = useMemo(
    () => [...offerings].sort((left, right) => compareOfferings(left, right, sort)),
    [offerings, sort],
  );

  if (!offerings.length) {
    return null;
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        {offeringSortLabels.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              sort === key
                ? "border-deep-ink bg-deep-ink text-ivory"
                : "classify-chip-surface text-ink hover:bg-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {sorted.map((item) => (
          <Link
            key={item.id}
            href={`/schools/${schoolSlug}/courses/${item.courseSlug}`}
            className="rounded-[24px] classify-inner p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-ink">
                  {item.courseCode} - {item.courseName}
                </p>
                <p className="text-sm text-muted">{item.summary}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-ink">
                  {scoreToLabel(item.classifyScore)}
                </p>
                <p className="text-xs text-muted">score {formatScore(item.classifyScore)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
