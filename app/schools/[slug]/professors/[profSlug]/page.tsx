import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTrustBanner } from "@/components/data-trust-banner";
import { ProfessorCoursesList } from "@/components/professor/professor-courses-list";
import { ProfessorGradeTabs } from "@/components/professor/professor-grade-tabs";
import { ProfessorScheduleSnippets } from "@/components/professor/professor-schedule-snippets";
import { TrendSparkline } from "@/components/charts/trend-sparkline";
import { CoverageBadge } from "@/components/coverage-badge";
import { SaveItemButton } from "@/components/saved/save-item-button";
import { SiteHeader } from "@/components/site-header";
import { getProfessorProfile } from "@/lib/catalog";
import {
  formatFreshnessLabel,
  formatGpa,
  formatPercent,
  formatProfessorCoverageLevel,
  formatProfessorStatsAvailability,
  formatRating,
  formatScore,
  scoreToLabel,
  slugify,
} from "@/lib/utils";
import { metricHasTrend } from "@/components/charts/metric-trend-chart";

type ProfessorPageProps = {
  params: Promise<{ slug: string; profSlug: string }>;
};

export default async function ProfessorPage({ params }: ProfessorPageProps) {
  const { slug, profSlug } = await params;
  const profile = await getProfessorProfile(slug, profSlug);
  if (!profile) notFound();

  const primary = profile.professor;
  const primaryDepartment = primary.departments[0] ?? "General";
  const deptGpaAvg = getPlaceholderDepartmentGpa(primaryDepartment);
  const deptARateAvg = 38;
  const hasInstitutionalStats = primary.hasInstitutionalStats;
  const showInstitutionalTrend =
    hasInstitutionalStats &&
    (metricHasTrend(primary.trend, "aPct") || metricHasTrend(primary.trend, "avgGpa"));
  const offeringWithDeptDelta = profile.offerings.find((offering) => offering.departmentDelta);
  const dd = offeringWithDeptDelta?.departmentDelta;
  const gpaMeta = dd
    ? [
        dd.expectedGpaDelta != null
          ? `Expected GPA ${dd.expectedGpaDelta >= 0 ? "+" : ""}${dd.expectedGpaDelta.toFixed(2)} vs ${dd.baselineLabel}`
          : dd.baselineLabel,
      ].join(" — ")
    : `${formatDepartmentDelta(primary.expectedGpa, deptGpaAvg)} vs illustrative baseline (not your school's real average)`;
  const aMeta =
    dd?.aRateDelta != null
      ? `A-rate ${dd.aRateDelta >= 0 ? "+" : ""}${dd.aRateDelta.toFixed(1)} percentage points vs ${dd.baselineLabel}`
      : `~${deptARateAvg}% illustrative baseline (context only)`;

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10 pb-16 md:pb-10">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{profile.school.shortName}</p>
              <h1 className="app-page-title mt-3 font-semibold text-ink">
                {profile.displayProfessorName ?? primary.professorName}
              </h1>
              {profile.nameAliasFootnote.length ? (
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Also appears as: {profile.nameAliasFootnote.join("; ")}
                </p>
              ) : null}
              <p className="mt-2 text-base text-muted">{primary.professorTitle}</p>
              <p className="app-lead mt-4">{primary.summary}</p>
              {primary.departments.length ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">
                    Departments
                  </span>
                  {primary.departments.map((dept) => (
                    <Link
                      key={dept}
                      href={`/schools/${slug}/departments/${slugify(dept)}`}
                      className="rounded-full classify-chip-surface px-3 py-1.5 text-sm font-medium text-ink underline-offset-2 hover:bg-surface-raised-top/90 hover:underline"
                    >
                      {dept}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-3">
              <SaveItemButton
                itemType="professor"
                schoolSlug={slug}
                professorSlug={profSlug}
              />
              <CoverageBadge tier={primary.coverageTier} />
            </div>
          </div>

          {profile.offerings.length ? (
            <DataTrustBanner offering={profile.offerings[0]} className="mt-6" />
          ) : (
            <div className="mt-6 rounded-[22px] border border-border/80 bg-deep-ink/[0.04] px-4 py-3 text-sm">
              <p className="font-semibold text-ink">What this profile is built from</p>
              <p className="mt-1.5 leading-relaxed text-muted">
                This instructor is published from school directory, catalog, section, and matched
                evidence sources where available. Institutional GPA and trend modules appear only
                when real local evidence exists.
              </p>
            </div>
          )}

          <div className="mt-8 space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Classify score"
                value={scoreToLabel(primary.classifyScore)}
                meta={`(score: ${formatScore(primary.classifyScore)})`}
              />
              <StatCard
                label="Profile status"
                value={formatProfessorStatsAvailability(primary.statsAvailability)}
                meta={formatProfessorCoverageLevel(primary.coverageLevel)}
              />
              <StatCard
                label="Courses in catalog"
                value={String(primary.courseCount)}
                meta="Distinct course rows for this instructor"
              />
              <StatCard
                label="Sections in catalog"
                value={String(primary.sectionCount)}
                meta="Linked section rows in the published snapshot"
              />
            </div>

            {hasInstitutionalStats ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  Institutional grade evidence
                </p>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <StatCard
                    label="Expected GPA"
                    value={formatGpa(primary.expectedGpa)}
                    meta={gpaMeta}
                  />
                  <StatCard
                    label="A-rate"
                    value={formatPercent(primary.aRate)}
                    meta={aMeta}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-border/80 bg-background/60 px-4 py-4 text-sm text-muted">
                <p className="font-medium text-ink">Institutional GPA and A-rate</p>
                <p className="mt-1.5 leading-relaxed">
                  Not published for this instructor in the current snapshot. RMP and directory
                  signals below still apply where available.
                </p>
              </div>
            )}

            {primary.hasRmp ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  Rate My Professors (student-reported)
                </p>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <StatCard
                    label="RMP rating"
                    value={formatRating(primary.rmpRating)}
                    meta={`Difficulty ${formatRating(primary.rmpDifficulty)}`}
                  />
                  {primary.statsAvailability === "rmp_only" ? (
                    <StatCard
                      label="RMP reviews"
                      value={primary.sampleSize ? String(primary.sampleSize) : "Unavailable"}
                      meta="Student-reported count (not institutional grades)"
                    />
                  ) : (
                    <StatCard
                      label="RMP context"
                      value="Matched reviews"
                      meta="Combined profiles may blend institutional and student-reported signals"
                    />
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {profile.offerings.length ? (
          <div className="mt-8">
            <ProfessorGradeTabs
              offerings={profile.offerings}
              gradeSeriesByOfferingId={profile.gradeSeriesByOfferingId}
            />
          </div>
        ) : (
          <section className="mt-8 soft-panel rounded-[30px] p-5 sm:p-6">
            <p className="eyebrow">Evidence expanding</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              This profile is live before full grade aggregates
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Identity, departments, and course coverage are live. GPA, A-rate, and
              compare-ready aggregates appear as official local evidence is published.
            </p>
          </section>
        )}

        {primary.tags.length ? (
          <section className="mt-8 soft-panel rounded-[30px] p-5 sm:p-6">
            <p className="eyebrow">Student notes from RMP reviews</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {primary.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full classify-chip-surface px-4 py-2 text-sm text-ink"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {profile.sections.length || profile.sectionMeetings.length ? (
          <div className="mt-8">
            <ProfessorScheduleSnippets
              sections={profile.sections}
              meetings={profile.sectionMeetings}
              schoolSlug={slug}
            />
          </div>
        ) : null}

        <section className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="soft-panel rounded-[30px] p-5 sm:p-6">
            <p className="eyebrow">A% trend</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              How the A-rate has moved over time
            </h2>
            {showInstitutionalTrend ? (
              <>
                <TrendSparkline trend={primary.trend} className="mt-6" />
                <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
                  <span className="rounded-full classify-chip-surface px-3 py-1.5">
                    Freshness {formatFreshnessLabel(primary.evidenceFreshness)}
                  </span>
                  <span className="rounded-full classify-chip-surface px-3 py-1.5">
                    Courses {primary.courseCount}
                  </span>
                  <span className="rounded-full classify-chip-surface px-3 py-1.5">
                    Sample size {primary.sampleSize || "Unavailable"}
                  </span>
                  {primary.hasRmp ? (
                    <span className="rounded-full classify-chip-surface px-3 py-1.5">
                      RMP {formatRating(primary.rmpRating)} / diff{" "}
                      {formatRating(primary.rmpDifficulty)}
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="mt-6 text-sm leading-6 text-muted">
                Institutional term-by-term grade trends appear here when local official evidence is
                published for this instructor. Directory and RMP context may still be available
                above.
              </p>
            )}
          </div>

          <div className="soft-panel rounded-[30px] p-5 sm:p-6">
            <p className="eyebrow">Year-by-year A%</p>
            <div className="mt-5 space-y-3">
              {showInstitutionalTrend ? primary.trend.map((point) => {
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
              }) : (
                <p className="text-sm leading-6 text-muted">
                  A-rate history from official local sources appears when institutional evidence is
                  published for this instructor.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 soft-panel rounded-[30px] p-5 sm:p-6">
          <p className="eyebrow">Courses taught</p>
          <ProfessorCoursesList offerings={profile.offerings} schoolSlug={slug} />
          {!profile.offerings.length &&
          (primary.coursesTaught?.length || primary.courseCodes.length) ? (
            <div className="mt-4 rounded-[22px] border border-border/70 bg-background/50 px-4 py-4">
              <p className="text-sm font-semibold text-ink">Directory course coverage</p>
              <p className="mt-1 text-xs text-muted">
                No merged offering rows yet; these codes come from the instructor directory snapshot.
              </p>
              <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-ink/90">
                {(primary.coursesTaught?.length
                  ? primary.coursesTaught.map(
                      (course) => `${course.courseCode} — ${course.courseName}`,
                    )
                  : primary.courseCodes
                ).map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {!profile.offerings.length ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
              {primary.departments.map((department) => (
                <span
                  key={department}
                  className="rounded-full classify-chip-surface px-3 py-1.5"
                >
                  {department}
                </span>
              ))}
              {primary.coursePrefixes.map((prefix) => (
                <span
                  key={prefix}
                  className="rounded-full classify-chip-surface px-3 py-1.5"
                >
                  {prefix}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            {profile.offerings.length ? (
              <Link
                href={`/compare?ids=${profile.offerings[0].id}&school=${primary.schoolSlug}`}
                className="inline-flex min-w-[8.75rem] items-center justify-center whitespace-nowrap rounded-full bg-deep-ink px-5 py-3 text-center text-sm font-medium !text-ivory"
              >
                Add to compare
              </Link>
            ) : null}
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
    <div className="rounded-[26px] classify-inner p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-muted">{meta}</p>
    </div>
  );
}
