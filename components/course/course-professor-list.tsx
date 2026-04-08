"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CoverageBadge } from "@/components/coverage-badge";
import { dataTrustSummaryLine, isSmallSample } from "@/lib/data-trust";
import {
  compareOfferings,
  offeringSortLabels,
  type OfferingSortKey,
} from "@/lib/offering-sort";
import { type ProfessorCourseSummary } from "@/lib/types";
import {
  formatGpa,
  formatPercent,
  formatRating,
  formatScore,
  scoreToLabel,
} from "@/lib/utils";

export function CourseProfessorList({
  offerings,
  schoolSlug,
}: {
  offerings: ProfessorCourseSummary[];
  schoolSlug: string;
}) {
  const [sortKey, setSortKey] = useState<OfferingSortKey>("name");

  const sorted = useMemo(
    () => [...offerings].sort((left, right) => compareOfferings(left, right, sortKey)),
    [offerings, sortKey],
  );

  return (
    <section className="mt-8 soft-panel rounded-[30px] p-5 sm:p-6">
      <div className="sticky top-24 z-10 -mx-2 mb-5 flex flex-wrap gap-2 rounded-[24px] border border-border/70 bg-background/92 p-3 backdrop-blur sm:mx-0">
        {offeringSortLabels.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSortKey(item.key)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              sortKey === item.key
                ? "border-deep-ink bg-deep-ink text-ivory"
                : "border-border bg-white/72 text-ink hover:bg-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {sorted.map((item) => (
          <div
            key={item.id}
            className="grid gap-4 rounded-[24px] border border-border/70 bg-white/72 px-4 py-4 lg:grid-cols-[1.08fr_0.92fr_auto]"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-ink">{item.professorName}</h2>
                <CoverageBadge tier={item.coverageTier} className="text-[0.62rem]" />
              </div>
              <p className="mt-1 text-sm text-muted">
                {item.courseCode} - {item.courseName}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{dataTrustSummaryLine(item)}</p>
              {isSmallSample(item.sampleSize) ? (
                <p className="mt-2 text-xs font-medium text-copper">Small sample — use as a hint, not a guarantee.</p>
              ) : null}
              <p className="mt-3 text-sm text-ink/78">{item.professorSummary}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <MetricCard
                label="Classify"
                value={scoreToLabel(item.classifyScore)}
                meta={`score: ${formatScore(item.classifyScore)}`}
              />
              <MetricCard label="Expected GPA" value={formatGpa(item.expectedGpa)} />
              <MetricCard label="A-rate" value={formatPercent(item.aRate)} />
              <MetricCard
                label="RMP"
                value={formatRating(item.rmpRating)}
                meta={`diff ${formatRating(item.rmpDifficulty)}`}
              />
            </div>

            <div className="flex flex-col gap-2 lg:items-end">
              <Link
                href={`/schools/${schoolSlug}/professors/${item.professorSlug}`}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-deep-ink px-4 py-2 text-sm font-medium !text-ivory lg:min-h-0"
              >
                Open profile
              </Link>
              <Link
                href={`/compare?ids=${item.id}&school=${item.schoolSlug}`}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium !text-ink lg:min-h-0"
              >
                Compare selected
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="rounded-2xl bg-background px-4 py-3 text-sm">
      <span className="text-muted">{label}</span>
      <p className="mt-1 font-semibold text-ink">{value}</p>
      {meta ? <p className="mt-1 text-xs text-muted">{meta}</p> : null}
    </div>
  );
}
