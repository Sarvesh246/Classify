"use client";

import { useMemo, useState } from "react";
import { estimatedChartCaption } from "@/lib/data-trust";
import { estimatedMixForOfferingSummary } from "@/lib/grade-distribution-estimate";
import { type ProfessorCourseSummary } from "@/lib/types";

const gradeColors = {
  A: "#639922",
  B: "#85B7EB",
  C: "#EF9F27",
  D: "#F0997B",
  F: "#E24B4A",
} as const;

export function ProfessorGradeTabs({
  offerings,
}: {
  offerings: ProfessorCourseSummary[];
}) {
  const [activeId, setActiveId] = useState(offerings[0]?.id ?? "");

  const active = useMemo(
    () => offerings.find((item) => item.id === activeId) ?? offerings[0],
    [activeId, offerings],
  );

  if (!active) {
    return null;
  }

  const distribution = estimatedMixForOfferingSummary({
    sampleSize: active.sampleSize,
    expectedGpa: active.expectedGpa,
    aRate: active.aRate,
  });
  const dateRange =
    active.trend.length > 1
      ? `${active.trend[0]?.term} to ${active.trend.at(-1)?.term}`
      : active.latestTerm;

  return (
    <section className="soft-panel rounded-[30px] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Grade distribution</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">
            Estimated letter mix (matches GPA and A-rate above)
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {estimatedChartCaption()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {offerings.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                item.id === active.id
                  ? "border-deep-ink bg-deep-ink text-ivory"
                  : "classify-chip-surface text-ink hover:bg-surface-raised-top/90"
              }`}
            >
              {item.courseCode}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[26px] classify-inner p-5">
        <div className="mb-5">
          <p className="text-lg font-semibold text-ink">
            {active.courseCode} - {active.courseName}
          </p>
          <p className="mt-1 text-sm text-muted">{active.professorSummary}</p>
        </div>

        <div className="space-y-3">
          {distribution.map((entry) => (
            <div key={entry.grade} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3">
              <span className="text-sm font-semibold text-ink">{entry.grade}</span>
              <div className="h-4 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${entry.pct <= 0 ? 0 : Math.max(entry.pct, 2)}%`,
                    backgroundColor: gradeColors[entry.grade],
                  }}
                />
              </div>
              <span className="text-sm font-medium text-ink">{entry.pct}%</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-full border border-border bg-background px-3 py-1.5">
            Sample size {active.sampleSize}
          </span>
          <span className="rounded-full border border-border bg-background px-3 py-1.5">
            Date range {dateRange}
          </span>
        </div>
      </div>
    </section>
  );
}
