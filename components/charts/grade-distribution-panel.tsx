"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { type GradeDistributionSeries } from "@/lib/types";

const gradeColors: Record<string, string> = {
  A: "bg-teal",
  B: "bg-[#7acb94]",
  C: "bg-[#e9c46a]",
  D: "bg-copper",
  F: "bg-[#d96b5f]",
};

export function GradeDistributionPanel({
  series,
  className,
}: {
  series: GradeDistributionSeries[];
  className?: string;
}) {
  const [selectedTerm, setSelectedTerm] = useState(series[0]?.term ?? "");
  const selected = useMemo(
    () => series.find((item) => item.term === selectedTerm) ?? series[0],
    [selectedTerm, series],
  );

  if (!series.length || !selected) {
    return (
      <div
        className={cn(
          "flex h-52 items-center justify-center rounded-[24px] border border-dashed border-border px-4 text-sm text-muted",
          className,
        )}
      >
        Grade distribution series is not published yet for this view.
      </div>
    );
  }

  return (
    <div className={cn("rounded-[24px] border border-border/70 bg-white/72 p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Grade distribution</p>
          <p className="mt-2 text-sm text-muted">
            {selected.estimated
              ? "Current seed uses published term averages to estimate the A/B/C/D/F mix until official section buckets are exported."
              : "Official section-bucket mix from published grade distributions."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {series.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedTerm(item.term)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selected.term === item.term
                  ? "border-deep-ink bg-deep-ink text-ivory"
                  : "border-border bg-background text-ink hover:bg-white"
              }`}
            >
              {item.term}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[20px] bg-background p-3">
        <div className="flex h-8 overflow-hidden rounded-full">
          {selected.buckets.map((bucket) => (
            <div
              key={bucket.grade}
              className={cn(
                "flex h-full items-center justify-center text-[0.7rem] font-semibold text-deep-ink",
                gradeColors[bucket.grade],
              )}
              style={{ width: `${Math.max(bucket.pct, 3)}%` }}
              title={`${bucket.grade}: ${bucket.pct}%`}
            >
              {bucket.grade}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-5">
        {selected.buckets.map((bucket) => (
          <div
            key={bucket.grade}
            className="rounded-[18px] border border-border/70 bg-background px-3 py-3 text-sm"
          >
            <p className="eyebrow">{bucket.grade}</p>
            <p className="mt-2 font-semibold text-ink">{bucket.count}</p>
            <p className="text-xs text-muted">{bucket.pct}%</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
        <span className="rounded-full border border-border bg-background px-3 py-1.5">
          Sample {selected.sampleSize}
        </span>
        <span className="rounded-full border border-border bg-background px-3 py-1.5">
          GPA {selected.avgGpa == null ? "Unavailable" : selected.avgGpa.toFixed(2)}
        </span>
        <span className="rounded-full border border-border bg-background px-3 py-1.5">
          Source {selected.sourceLabel}
        </span>
      </div>
    </div>
  );
}
