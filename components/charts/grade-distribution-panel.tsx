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

/** User-facing copy for catalog / ETL source keys (legacy rows may still use older strings). */
function formatGradeDistributionSourceLabel(raw: string): string {
  if (/^TAMU grade report PDF$/i.test(raw.trim())) {
    return "TAMU Grade Report";
  }
  return raw;
}

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
    <div className={cn("rounded-[24px] classify-inner p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Grade distribution</p>
          <p className="mt-2 text-sm text-muted">
            {selected.estimated
              ? "Bars are approximated from each term’s reported average GPA and A-rate (we do not store full A–F counts in the catalog yet). When those stats show near-all A’s, we do not invent extra letter grades."
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
                  : "border-border bg-background text-ink hover:bg-surface-raised-top/90"
              }`}
            >
              {item.term}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[20px] bg-background p-3">
        {/*
          Proportional flex (not %-width with a per-segment min %) so shares always sum to the
          track width — min % was overflowing and clipping the right end of the bar.
          Labels use neutral-950, not text-deep-ink: dark mode maps deep-ink to --foreground (light),
          which is unreadable on these fixed bright bar fills.
        */}
        <div className="flex h-8 w-full min-w-0 overflow-hidden rounded-full">
          {selected.buckets.map((bucket) => (
            <div
              key={bucket.grade}
              className={cn(
                "flex min-h-full min-w-0 items-center justify-center overflow-hidden text-[0.7rem] font-semibold text-neutral-950",
                gradeColors[bucket.grade],
              )}
              style={{
                flexGrow: bucket.pct > 0 ? bucket.pct : 0,
                flexShrink: 1,
                flexBasis: 0,
              }}
              title={`${bucket.grade}: ${bucket.pct}%`}
            >
              <span className="truncate px-0.5">{bucket.grade}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-5">
        {selected.buckets.map((bucket) => (
          <div
            key={bucket.grade}
            className="classify-well rounded-[18px] px-3 py-3 text-sm"
          >
            <p className="eyebrow">{bucket.grade}</p>
            <p className="mt-2 font-semibold text-ink">{bucket.count}</p>
            <p className="text-xs text-muted">{bucket.pct}%</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
        <span className="classify-well rounded-full px-3 py-1.5">
          Sample {selected.sampleSize}
        </span>
        <span className="classify-well rounded-full px-3 py-1.5">
          GPA {selected.avgGpa == null ? "Unavailable" : selected.avgGpa.toFixed(2)}
        </span>
        <span className="classify-well rounded-full px-3 py-1.5">
          Source: {formatGradeDistributionSourceLabel(selected.sourceLabel)}
        </span>
      </div>
    </div>
  );
}
