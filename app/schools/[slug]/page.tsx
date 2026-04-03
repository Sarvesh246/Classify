import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRight, Gem, Layers3 } from "lucide-react";
import { CoverageBadge } from "@/components/coverage-badge";
import { SiteHeader } from "@/components/site-header";
import { getCatalogSchools } from "@/lib/catalog";
import { getSchoolHub } from "@/lib/server-directory";
import {
  formatGpa,
  formatPercent,
  formatScore,
  scoreToLabel,
} from "@/lib/utils";

type SchoolPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return getCatalogSchools().map((school) => ({ slug: school.slug }));
}

export default async function SchoolPage({ params }: SchoolPageProps) {
  const { slug } = await params;
  const hub = await getSchoolHub(slug);
  if (!hub) notFound();

  const { school, courses, offerings, departments, hiddenGems } = hub;
  const topProfessors = [...offerings]
    .sort((left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0))
    .slice(0, 4);

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">
                {school.city}, {school.state}
              </p>
              <h1 className="app-page-title mt-3 font-semibold text-ink">
                {school.name}
              </h1>
              <p className="app-lead mt-4">
                {school.descriptor} Search stays live across the full school directory,
                but the amount of course intelligence exposed depends on the current
                coverage tier.
              </p>
            </div>
            <CoverageBadge tier={school.coverageTier} />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <InfoCard label="Primary source" value={school.sourceStatus.primary} />
            <InfoCard label="Fallback" value={school.sourceStatus.fallback} />
            <InfoCard label="Freshness" value={school.sourceStatus.freshness} />
          </div>
        </section>

        <section className="mt-8 soft-panel rounded-[30px] p-5 sm:p-6">
          <p className="eyebrow">Top searched courses</p>
          {courses.length ? (
            <div className="mt-5 space-y-3">
              {courses.map((course) => (
                <Link
                  key={course.courseSlug}
                  href={`/schools/${slug}/courses/${course.courseSlug}`}
                  className="flex flex-col gap-2 rounded-[24px] border border-border/70 bg-white/72 px-4 py-4 transition hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-ink">
                        {course.courseCode} - {course.courseName}
                      </h2>
                      <p className="text-sm text-muted">{course.department}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted" />
                  </div>
                  <p className="text-sm text-ink/78">{course.summary}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted">
                    <span className="rounded-full border border-border bg-background px-3 py-1.5">
                      Top pick {course.topProfessorName}
                    </span>
                    <span className="rounded-full border border-border bg-background px-3 py-1.5">
                      {course.topClassifyScore == null
                        ? "Classify unavailable"
                        : `${scoreToLabel(course.topClassifyScore)} · score ${formatScore(course.topClassifyScore)}`}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyCard>
              This school is currently in fallback mode. The school hub stays live
              for search and profile discovery, and course-level grade intelligence
              appears here once the institutional adapter is added.
            </EmptyCard>
          )}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="soft-panel rounded-[30px] p-5 sm:p-6">
            <p className="eyebrow">Top professor picks</p>
            {topProfessors.length ? (
              <div className="mt-5 space-y-3">
                {topProfessors.map((item) => (
                  <Link
                    key={item.id}
                    href={`/schools/${slug}/professors/${item.professorSlug}`}
                    className="block rounded-[24px] border border-border/70 bg-white/72 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-ink">
                          {item.professorName}
                        </h2>
                        <p className="mt-1 text-sm text-muted">
                          {item.courseCode} - {item.courseName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-ink">
                          {scoreToLabel(item.classifyScore)}
                        </p>
                        <p className="text-xs text-muted">score {formatScore(item.classifyScore)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-ink/78">{item.summary}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyCard>
                No professor-course aggregates are published for this school yet, but
                the route is live and ready for imported RMP or institutional data.
              </EmptyCard>
            )}
          </div>

          <div className="soft-panel rounded-[30px] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-deep-ink text-ivory">
                <Layers3 className="h-4 w-4" />
              </div>
              <div>
                <p className="eyebrow">Department rankings</p>
                <h2 className="text-2xl font-semibold text-ink">
                  Strongest departments right now
                </h2>
              </div>
            </div>
            {departments.length ? (
              <div className="mt-5 space-y-3">
                {departments.slice(0, 6).map((department) => (
                  <Link
                    key={department.departmentSlug}
                    href={`/schools/${slug}/departments/${department.departmentSlug}`}
                    className="flex items-center justify-between gap-4 rounded-[22px] border border-border/70 bg-white/72 px-4 py-4 transition hover:bg-white"
                  >
                    <div>
                      <p className="text-lg font-semibold text-ink">
                        {department.department}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {department.professorCount} professors · {department.courseCount} courses
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted">
                      <p>Classify {formatScore(department.avgClassifyScore)}</p>
                      <p>GPA {formatGpa(department.avgExpectedGpa)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyCard>No department aggregates are published for this school yet.</EmptyCard>
            )}
          </div>
        </section>

        <section className="mt-8 soft-panel rounded-[30px] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/20 text-deep-ink">
              <Gem className="h-4 w-4" />
            </div>
            <div>
              <p className="eyebrow">Hidden gems</p>
              <h2 className="text-2xl font-semibold text-ink">
                High-outcome options with lower enrollment
              </h2>
            </div>
          </div>
          {hiddenGems.length ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {hiddenGems.map((item) => (
                <Link
                  key={item.id}
                  href={`/schools/${slug}/professors/${item.professorSlug}`}
                  className="rounded-[24px] border border-border/70 bg-white/72 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-ink">{item.professorName}</p>
                      <p className="text-sm text-muted">
                        {item.courseCode} - {item.courseName}
                      </p>
                    </div>
                    <CoverageBadge tier={item.coverageTier} className="text-[0.62rem]" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                    <span className="rounded-full border border-border bg-background px-3 py-1.5">
                      {scoreToLabel(item.classifyScore)} · score {formatScore(item.classifyScore)}
                    </span>
                    <span className="rounded-full border border-border bg-background px-3 py-1.5">
                      GPA {formatGpa(item.expectedGpa)}
                    </span>
                    <span className="rounded-full border border-border bg-background px-3 py-1.5">
                      A-rate {formatPercent(item.aRate)}
                    </span>
                    <span className="rounded-full border border-border bg-background px-3 py-1.5">
                      Sample {item.sampleSize}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyCard>
              Hidden gem surfacing becomes more meaningful once the school has more
              section-level coverage.
            </EmptyCard>
          )}
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[26px] border border-border/70 bg-white/72 p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-[26px] border border-dashed border-border px-4 py-12 text-sm text-muted">
      {children}
    </div>
  );
}
