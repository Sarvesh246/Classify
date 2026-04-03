"use client";

import { useMemo, useState } from "react";
import { type ProfessorCourseSummary } from "@/lib/types";

const gradeColors = {
  A: "#639922",
  B: "#85B7EB",
  C: "#EF9F27",
  D: "#F0997B",
  F: "#E24B4A",
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function buildDistribution(item: ProfessorCourseSummary) {
  const aPct = clamp(item.aRate ?? 0, 0, 100);
  const bPct = clamp(((item.expectedGpa ?? 0) - 2.0) * 15, 0, 35);
  const dPct = 5;
  const fPct = clamp(100 - aPct - bPct - dPct, 0, 3);
  const cPct = clamp(100 - aPct - bPct - dPct - fPct, 0, 100);

  return [
    { grade: "A", pct: round(aPct) },
    { grade: "B", pct: round(bPct) },
    { grade: "C", pct: round(cPct) },
    { grade: "D", pct: round(dPct) },
    { grade: "F", pct: round(fPct) },
  ] as const;
}

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

  const distribution = buildDistribution(active);
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
            Approximate letter outcomes by course
          </h2>
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
                  : "border-border bg-white/72 text-ink hover:bg-white"
              }`}
            >
              {item.courseCode}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[26px] border border-border/70 bg-white/72 p-5">
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
                    width: `${Math.max(entry.pct, 2)}%`,
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
