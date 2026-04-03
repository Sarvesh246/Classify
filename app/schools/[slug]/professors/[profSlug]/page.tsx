import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTrustBanner } from "@/components/data-trust-banner";
import { ProfessorCoursesList } from "@/components/professor/professor-courses-list";
import { ProfessorGradeTabs } from "@/components/professor/professor-grade-tabs";
import { TrendSparkline } from "@/components/charts/trend-sparkline";
import { CoverageBadge } from "@/components/coverage-badge";
import { SiteHeader } from "@/components/site-header";
import { getCatalogOfferings, getProfessorProfile } from "@/lib/catalog";
import {
  confidenceToLabel,
  formatGpa,
  formatPercent,
  formatRating,
  formatScore,
  scoreToLabel,
} from "@/lib/utils";

type ProfessorPageProps = {
  params: Promise<{ slug: string; profSlug: string }>;
};

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return getCatalogOfferings().map((offering) => ({
    slug: offering.schoolSlug,
    profSlug: offering.professorSlug,
  }));
}

export default async function ProfessorPage({ params }: ProfessorPageProps) {
  const { slug, profSlug } = await params;
  const profile = getProfessorProfile(slug, profSlug);
  if (!profile) notFound();

  const primary = profile.professor;
  const deptGpaAvg = getPlaceholderDepartmentGpa(primary.department);
  const deptARateAvg = 38;

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{profile.school.shortName}</p>
              <h1 className="app-page-title mt-3 font-semibold text-ink">
                {primary.professorName}
              </h1>
              <p className="mt-2 text-base text-muted">{primary.professorTitle}</p>
              <p className="app-lead mt-4">{primary.professorSummary}</p>
            </div>
            <CoverageBadge tier={primary.coverageTier} />
          </div>

          <DataTrustBanner offering={primary} className="mt-6" />

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Classify score"
              value={scoreToLabel(primary.classifyScore)}
              meta={`(score: ${formatScore(primary.classifyScore)})`}
            />
            <StatCard
              label="Expected GPA"
              value={formatGpa(primary.expectedGpa)}
              meta={`${formatDepartmentDelta(primary.expectedGpa, deptGpaAvg)} vs dept avg`}
            />
            <StatCard
              label="A-rate"
              value={formatPercent(primary.aRate)}
              meta={`dept avg ~${deptARateAvg}%`}
            />
            <StatCard
              label="Data quality"
              value={confidenceToLabel(primary.confidence)}
              meta="Based on sample size, term coverage, and source mix"
            />
          </div>
        </section>

        <div className="mt-8">
          <ProfessorGradeTabs offerings={profile.offerings} />
        </div>

        {primary.tags.length ? (
          <section className="mt-8 soft-panel rounded-[30px] p-5 sm:p-6">
            <p className="eyebrow">Student notes from RMP reviews</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {primary.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-white/72 px-4 py-2 text-sm text-ink"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="soft-panel rounded-[30px] p-5 sm:p-6">
            <p className="eyebrow">A% trend</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              How the A-rate has moved over time
            </h2>
            <TrendSparkline trend={primary.trend} className="mt-6" />
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
              <span className="rounded-full border border-border bg-white/72 px-3 py-1.5">
                Freshness {primary.freshness}
              </span>
              <span className="rounded-full border border-border bg-white/72 px-3 py-1.5">
                Latest term {primary.latestTerm}
              </span>
              <span className="rounded-full border border-border bg-white/72 px-3 py-1.5">
                Sample size {primary.sampleSize}
              </span>
              <span className="rounded-full border border-border bg-white/72 px-3 py-1.5">
                RMP {formatRating(primary.rmpRating)} / diff {formatRating(primary.rmpDifficulty)}
              </span>
            </div>
          </div>

          <div className="soft-panel rounded-[30px] p-5 sm:p-6">
            <p className="eyebrow">Year-by-year A%</p>
            <div className="mt-5 space-y-3">
              {primary.trend.map((point) => {
                const value = point.aPct ?? 0;
                const color =
                  value > 50 ? "#639922" : value >= 30 ? "#EF9F27" : "#F0997B";

                return (
                  <div
                    key={point.term}
                    className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3"
                  >
                    <span className="text-sm text-muted">{point.term}</span>
                    <div className="h-4 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(value, 2)}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="text-sm font-medium text-ink">
                      {point.aPct == null ? "N/A" : `${Math.round(point.aPct)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-8 soft-panel rounded-[30px] p-5 sm:p-6">
          <p className="eyebrow">Courses taught</p>
          <ProfessorCoursesList offerings={profile.offerings} schoolSlug={slug} />
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/compare?ids=${primary.id}&school=${primary.schoolSlug}`}
              className="inline-flex min-w-[8.75rem] items-center justify-center whitespace-nowrap rounded-full bg-deep-ink px-5 py-3 text-center text-sm font-medium !text-ivory"
            >
              Add to compare
            </Link>
            <Link
              href={`/schools/${slug}`}
              className="inline-flex min-w-[8.75rem] items-center justify-center whitespace-nowrap rounded-full border border-border px-5 py-3 text-center text-sm font-medium !text-ink"
            >
              Back to school hub
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function getPlaceholderDepartmentGpa(department: string) {
  const normalized = department.toLowerCase();

  if (normalized.includes("computer") || normalized.includes("engineering")) {
    return 3.1;
  }

  if (normalized.includes("math")) {
    return 3.2;
  }

  if (
    normalized.includes("econ") ||
    normalized.includes("social") ||
    normalized.includes("polit") ||
    normalized.includes("psych")
  ) {
    return 3.3;
  }

  return 3.2;
}

function formatDepartmentDelta(value: number | null, baseline: number) {
  if (value == null) {
    return "Unavailable";
  }

  const delta = value - baseline;
  const prefix = delta >= 0 ? "+" : "-";
  return `${prefix}${Math.abs(delta).toFixed(2)}`;
}

function StatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-[26px] border border-border/70 bg-white/72 p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-muted">{meta}</p>
    </div>
  );
}
