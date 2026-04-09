"use client";

import { useMemo, useState } from "react";
import { estimatedChartCaption } from "@/lib/data-trust";
import { estimatedMixForOfferingSummary } from "@/lib/grade-distribution-estimate";
import type { GradeDistributionSeries, ProfessorCourseSummary } from "@/lib/types";

const gradeColors = {
  A: "#639922",
  B: "#85B7EB",
  C: "#EF9F27",
  D: "#F0997B",
  F: "#E24B4A",
} as const;

function pickLatestOfficialSeries(
  series: GradeDistributionSeries[] | undefined,
): GradeDistributionSeries | null {
  if (!series?.length) {
    return null;
  }
  const withCounts = series.filter((s) => s.buckets.some((b) => b.count > 0));
  if (!withCounts.length) {
    return null;
  }
  return withCounts[withCounts.length - 1];
}

function GradeBars({
  rows,
  subtle,
}: {
  rows: { grade: string; pct: number }[];
  subtle?: boolean;
}) {
  return (
    <div className={`space-y-3 ${subtle ? "opacity-95" : ""}`}>
      {rows.map((entry) => {
        const key = entry.grade as keyof typeof gradeColors;
        const color = gradeColors[key] ?? "#94a3b8";
        return (
          <div key={entry.grade} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3">
            <span className="text-sm font-semibold text-ink">{entry.grade}</span>
            <div className="h-4 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${entry.pct <= 0 ? 0 : Math.max(entry.pct, 2)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span className="text-sm font-medium text-ink">{entry.pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

export function ProfessorGradeTabs({
  offerings,
  gradeSeriesByOfferingId = {},
}: {
  offerings: ProfessorCourseSummary[];
  gradeSeriesByOfferingId?: Record<string, GradeDistributionSeries[]>;
}) {
  const [activeId, setActiveId] = useState(offerings[0]?.id ?? "");

  const active = useMemo(
    () => offerings.find((item) => item.id === activeId) ?? offerings[0],
    [activeId, offerings],
  );

  if (!active) {
    return null;
  }

  const estimatedRows = estimatedMixForOfferingSummary({
    sampleSize: active.sampleSize,
    expectedGpa: active.expectedGpa,
    aRate: active.aRate,
  }).map((entry) => ({ grade: entry.grade, pct: entry.pct }));

  const officialSeries = pickLatestOfficialSeries(gradeSeriesByOfferingId[active.id]);
  const officialRows =
    officialSeries?.buckets.map((b) => ({
      grade: b.grade,
      pct: Math.round(b.pct * 10) / 10,
    })) ?? [];

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
            {officialSeries ? "Published term-level grade mix" : "Estimated letter mix"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {officialSeries ? (
              <>
                Term <span className="font-medium text-ink">{officialSeries.term}</span>
                {officialSeries.sourceLabel ? (
                  <>
                    {" "}
                    · <span className="text-ink/80">{officialSeries.sourceLabel}</span>
                  </>
                ) : null}
                {officialSeries.estimated ? (
                  <span className="block pt-1">This row is still modeled or partial; treat as supporting context.</span>
                ) : (
                  <span className="block pt-1">Shares come from published bucket counts in the catalog snapshot.</span>
                )}
              </>
            ) : (
              estimatedChartCaption()
            )}
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

        {officialSeries ? (
          <GradeBars rows={officialRows} />
        ) : (
          <GradeBars rows={estimatedRows} />
        )}

        {officialSeries ? (
          <div className="mt-8 border-t border-border/80 pt-6">
            <p className="eyebrow">Modeled comparison</p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
              Approximate letter mix inferred from expected GPA and A-rate on this offering (not an official
              bucket extract).
            </p>
            <div className="mt-4">
              <GradeBars rows={estimatedRows} subtle />
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-full border border-border bg-background px-3 py-1.5">
            Sample size {officialSeries?.sampleSize ?? active.sampleSize}
          </span>
          <span className="rounded-full border border-border bg-background px-3 py-1.5">
            Snapshot range {dateRange}
          </span>
        </div>
      </div>
    </section>
  );
}
