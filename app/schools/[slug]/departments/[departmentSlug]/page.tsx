import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverageBadge } from "@/components/coverage-badge";
import { SiteHeader } from "@/components/site-header";
import {
  getDepartmentAggregate,
  getDepartmentOfferingsForSchool,
} from "@/lib/catalog";
import type { ProfessorCourseSummary } from "@/lib/types";
import {
  formatGpa,
  formatPercent,
  formatScore,
  formatSignedDelta,
} from "@/lib/utils";

type DepartmentPageProps = {
  params: Promise<{ slug: string; departmentSlug: string }>;
  searchParams: Promise<{ sort?: string }>;
};

const sorters = {
  classify: (item: ProfessorCourseSummary) => item.classifyScore ?? -1,
  gpa: (item: ProfessorCourseSummary) => item.expectedGpa ?? -1,
  arate: (item: ProfessorCourseSummary) => item.aRate ?? -1,
  trend: (item: ProfessorCourseSummary) => item.trendDelta ?? -999,
  trend_hard: (item: ProfessorCourseSummary) =>
    item.trendDelta == null ? -99999 : -item.trendDelta,
};

export default async function DepartmentPage({
  params,
  searchParams,
}: DepartmentPageProps) {
  const { slug, departmentSlug } = await params;
  const { sort = "classify" } = await searchParams;
  const department = await getDepartmentAggregate(slug, departmentSlug);

  if (!department) {
    notFound();
  }

  const sortKey = sort in sorters ? (sort as keyof typeof sorters) : "classify";
  const offerings = (await getDepartmentOfferingsForSchool(slug, departmentSlug)).sort(
    (left, right) => sorters[sortKey](right) - sorters[sortKey](left),
  );

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Department ranking</p>
              <h1 className="app-page-title mt-3 font-semibold text-ink">
                {department.department}
              </h1>
              <p className="app-lead mt-4">
                Ranked professor-course options for this department, weighted toward
                current expected GPA, A-rate, and coverage confidence rather than
                anecdote alone.
              </p>
            </div>
            <CoverageBadge tier={department.coverageTier} />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Department Classify"
              value={formatScore(department.avgClassifyScore)}
            />
            <MetricCard
              label="Department GPA"
              value={formatGpa(department.avgExpectedGpa)}
            />
            <MetricCard
              label="Department A-rate"
              value={formatPercent(department.avgARate)}
            />
            <MetricCard
              label="Coverage"
              value={`${department.professorCount} profs | ${department.courseCount} courses`}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            <span className="self-center text-muted">Quick sort:</span>
            <Link
              href={`/schools/${slug}/departments/${departmentSlug}?sort=gpa`}
              className="rounded-full border border-border bg-white/72 px-3 py-1.5 font-medium text-ink hover:bg-white"
            >
              Easiest GPA
            </Link>
            <Link
              href={`/schools/${slug}/departments/${departmentSlug}?sort=trend_hard`}
              className="rounded-full border border-border bg-white/72 px-3 py-1.5 font-medium text-ink hover:bg-white"
            >
              Toughest trend
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {[
              ["classify", "Best overall"],
              ["gpa", "Highest GPA"],
              ["arate", "Most A's"],
              ["trend", "Easiest trend lately"],
              ["trend_hard", "Hardest trend lately"],
            ].map(([value, label]) => (
              <Link
                key={value}
                href={`/schools/${slug}/departments/${departmentSlug}?sort=${value}`}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  sortKey === value
                    ? "border-deep-ink bg-deep-ink text-ivory"
                    : "border-border bg-white/72 text-ink hover:bg-white"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8 soft-panel rounded-[30px] p-5 sm:p-6">
          <div className="space-y-3">
            {offerings.map((item) => (
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
                  <p className="mt-3 text-sm text-ink/78">{item.professorSummary}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <MetricCard label="Classify" value={formatScore(item.classifyScore)} compact />
                  <MetricCard label="Expected GPA" value={formatGpa(item.expectedGpa)} compact />
                  <MetricCard label="A-rate" value={formatPercent(item.aRate)} compact />
                  <MetricCard label="Sample" value={String(item.sampleSize)} compact />
                </div>
                <div className="flex flex-col gap-2 lg:items-end">
                  <Link
                    href={`/schools/${slug}/professors/${item.professorSlug}`}
                    className="rounded-full bg-deep-ink px-4 py-2 text-sm font-medium text-ivory"
                  >
                    Open profile
                  </Link>
                  {item.departmentDelta ? (
                    <div className="rounded-[20px] border border-border bg-background px-4 py-3 text-xs text-muted">
                      <p>
                        {formatSignedDelta(
                          item.departmentDelta.expectedGpaDelta,
                          (value) => value.toFixed(2),
                        )}{" "}
                        GPA vs dept
                      </p>
                      <p>
                        {formatSignedDelta(
                          item.departmentDelta.aRateDelta,
                          (value) => `${Math.round(value)}%`,
                        )}{" "}
                        A-rate vs dept
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border/70 bg-white/72 ${
        compact ? "px-4 py-3 text-sm" : "p-5"
      }`}
    >
      <p className="eyebrow">{label}</p>
      <p className={`mt-3 font-semibold text-ink ${compact ? "text-xl" : "text-4xl"}`}>
        {value}
      </p>
    </div>
  );
}
