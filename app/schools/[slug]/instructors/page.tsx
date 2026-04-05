import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverageBadge } from "@/components/coverage-badge";
import { SiteHeader } from "@/components/site-header";
import { getCatalogOfferingsForSchool } from "@/lib/catalog";
import { getDirectorySchoolBySlug } from "@/lib/server-directory";
import { professorLastNameSortKey } from "@/lib/professor-sort";
import { slugify } from "@/lib/utils";
import type { ProfessorCourseSummary } from "@/lib/types";
import {
  formatGpa,
  formatPercent,
  formatRating,
  formatScore,
  scoreToLabel,
} from "@/lib/utils";

const PAGE_SIZE = 48;

type InstructorsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sort?: string;
    dept?: string;
    q?: string;
    page?: string;
    evidence?: string;
    planning?: string;
  }>;
};

export const revalidate = 3600;
export const dynamicParams = true;

type CatalogOffering = ProfessorCourseSummary;

const instructorNumericSorters = {
  classify: (item: CatalogOffering) => item.classifyScore ?? -1,
  gpa: (item: CatalogOffering) => item.expectedGpa ?? -1,
  arate: (item: CatalogOffering) => item.aRate ?? -1,
  trend: (item: CatalogOffering) => item.trendDelta ?? -999,
  rating: (item: CatalogOffering) => item.rmpRating ?? -1,
};

type InstructorSortKey = "name" | keyof typeof instructorNumericSorters;

const instructorSortKeys: InstructorSortKey[] = [
  "name",
  "classify",
  "gpa",
  "arate",
  "trend",
  "rating",
];

function compareInstructorRows(
  left: CatalogOffering,
  right: CatalogOffering,
  sortKey: InstructorSortKey,
): number {
  if (sortKey === "name") {
    const c = professorLastNameSortKey(left.professorName).localeCompare(
      professorLastNameSortKey(right.professorName),
      undefined,
      { sensitivity: "base" },
    );
    if (c !== 0) return c;
    return left.professorName.localeCompare(right.professorName, undefined, {
      sensitivity: "base",
    });
  }
  return instructorNumericSorters[sortKey](right) - instructorNumericSorters[sortKey](left);
}

export default async function InstructorsDirectoryPage({ params, searchParams }: InstructorsPageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const [school, allRows] = await Promise.all([
    getDirectorySchoolBySlug(slug),
    getCatalogOfferingsForSchool(slug),
  ]);
  if (!school) notFound();

  const sortKey: InstructorSortKey =
    sp.sort && instructorSortKeys.includes(sp.sort as InstructorSortKey)
      ? (sp.sort as InstructorSortKey)
      : "name";
  const deptFilter = sp.dept?.trim() ?? "";
  const q = sp.q?.trim().toLowerCase() ?? "";
  const evidenceFilter = sp.evidence?.trim() ?? "";
  const planningFilter = sp.planning?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  let rows = [...allRows];

  if (deptFilter) {
    rows = rows.filter((item) => slugify(item.department) === deptFilter);
  }
  if (q) {
    rows = rows.filter((item) => {
      const hay = `${item.professorName} ${item.courseCode} ${item.courseName} ${item.department}`.toLowerCase();
      return hay.includes(q);
    });
  }
  if (evidenceFilter === "official") {
    rows = rows.filter((item) => item.evidenceProfile?.hasOfficialGrades);
  } else if (evidenceFilter === "mixed") {
    rows = rows.filter(
      (item) =>
        !item.evidenceProfile?.hasOfficialGrades &&
        Boolean(item.evidenceProfile?.hasRmp || item.evidenceProfile?.hasCommunityEvidence),
    );
  } else if (evidenceFilter === "limited") {
    rows = rows.filter((item) => !item.evidenceProfile?.hasOfficialGrades);
  }
  if (planningFilter === "schedule") {
    rows = rows.filter((item) => item.hasSectionPlanning);
  } else if (planningFilter === "catalog") {
    rows = rows.filter((item) => !item.hasSectionPlanning);
  }

  rows.sort((left, right) => compareInstructorRows(left, right, sortKey));

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  const departments = [
    ...new Set(allRows.map((o) => o.department)),
  ].sort((a, b) => a.localeCompare(b));

  const sortLinks = [
    ["name", "A-Z (last name)"],
    ["classify", "Classify score"],
    ["gpa", "Expected GPA"],
    ["arate", "A-rate"],
    ["trend", "Trend"],
    ["rating", "RMP rating"],
  ] as const satisfies readonly (readonly [InstructorSortKey, string])[];

  function href(extra: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    p.set("sort", extra.sort ?? sortKey);
    if (extra.dept !== undefined ? extra.dept : deptFilter) {
      p.set("dept", (extra.dept !== undefined ? extra.dept : deptFilter) || "");
    }
    if (extra.q !== undefined ? extra.q : q) {
      p.set("q", (extra.q !== undefined ? extra.q : q) || "");
    }
    if (extra.evidence !== undefined ? extra.evidence : evidenceFilter) {
      p.set("evidence", (extra.evidence !== undefined ? extra.evidence : evidenceFilter) || "");
    }
    if (extra.planning !== undefined ? extra.planning : planningFilter) {
      p.set("planning", (extra.planning !== undefined ? extra.planning : planningFilter) || "");
    }
    const pg = extra.page ?? (safePage > 1 ? String(safePage) : "");
    if (pg && pg !== "1") p.set("page", pg);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <p className="eyebrow">{school.shortName}</p>
          <h1 className="app-page-title mt-3 font-semibold text-ink">All instructors</h1>
          <p className="app-lead mt-4">
            Browse every professor-course row we publish for this school ({total} total). Default
            order is A-Z by professor last name; you can also sort by outcomes. Filter by department
            or search - no need to know a name first.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/schools/${slug}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink"
            >
              School hub
            </Link>
            <Link
              href={`/schools/${slug}/my-courses`}
              className="rounded-full bg-deep-ink px-4 py-2 text-sm font-medium text-ivory"
            >
              My courses
            </Link>
          </div>
        </section>

        <section className="mt-8 soft-panel rounded-[30px] p-5 sm:p-6">
          <form className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end" action="" method="get">
            <input type="hidden" name="sort" value={sortKey} />
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-muted">Search</span>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Name, course code, department..."
                className="h-11 min-w-[14rem] rounded-2xl border border-border bg-white/80 px-4 outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-muted">Department</span>
              <select
                name="dept"
                defaultValue={deptFilter}
                className="h-11 min-w-[12rem] rounded-2xl border border-border bg-white/80 px-4 outline-none"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={slugify(d)}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-muted">Evidence</span>
              <select
                name="evidence"
                defaultValue={evidenceFilter}
                className="h-11 min-w-[11rem] rounded-2xl border border-border bg-white/80 px-4 outline-none"
              >
                <option value="">All evidence</option>
                <option value="official">Official grades</option>
                <option value="mixed">Mixed signals</option>
                <option value="limited">Limited evidence</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-muted">Planning</span>
              <select
                name="planning"
                defaultValue={planningFilter}
                className="h-11 min-w-[11rem] rounded-2xl border border-border bg-white/80 px-4 outline-none"
              >
                <option value="">All planning states</option>
                <option value="schedule">Section timing ready</option>
                <option value="catalog">Catalog only</option>
              </select>
            </label>
            <button
              type="submit"
              className="h-11 rounded-full bg-deep-ink px-6 text-sm font-medium text-ivory"
            >
              Apply filters
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-2">
            {sortLinks.map(([key, label]) => (
              <Link
                key={key}
                href={`/schools/${slug}/instructors${href({ sort: key, page: "1" })}`}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  sortKey === key
                    ? "border-deep-ink bg-deep-ink text-ivory"
                    : "border-border bg-white/72 text-ink hover:bg-white"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8 space-y-3">
          {pageRows.length ? (
            pageRows.map((item) => (
              <div
                key={item.id}
                className="soft-panel flex flex-col gap-4 rounded-[24px] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink">{item.professorName}</h2>
                    <CoverageBadge tier={item.coverageTier} className="text-[0.62rem]" />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {item.courseCode} | {item.courseName} | {item.department}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-ink/78">{item.summary}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted">
                    {scoreToLabel(item.classifyScore)} ({formatScore(item.classifyScore)})
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted">
                    GPA {formatGpa(item.expectedGpa)}
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted">
                    A-rate {formatPercent(item.aRate)}
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted">
                    RMP {formatRating(item.rmpRating)}
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted">
                    {item.hasSectionPlanning ? "Section timing ready" : "Catalog only"}
                  </span>
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  <Link
                    href={`/schools/${slug}/professors/${item.professorSlug}`}
                    className="rounded-full bg-deep-ink px-4 py-2 text-center text-sm font-medium text-ivory"
                  >
                    Profile
                  </Link>
                  <Link
                    href={`/compare?ids=${item.id}`}
                    className="rounded-full border border-border px-4 py-2 text-center text-sm font-medium text-ink"
                  >
                    Compare
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="soft-panel rounded-[24px] px-6 py-14 text-center text-muted">
              {total
                ? "No rows match these filters. Clear search or try another department."
                : "This school page is live, but instructor rows have not been published locally yet. The same directory route will fill in automatically once catalog or schedule data is imported."}
            </div>
          )}
        </section>

        {totalPages > 1 ? (
          <nav className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {safePage > 1 ? (
              <Link
                href={`/schools/${slug}/instructors${href({ page: String(safePage - 1) })}`}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium"
              >
                Previous
              </Link>
            ) : null}
            <span className="text-sm text-muted">
              Page {safePage} of {totalPages} | {total} instructors
            </span>
            {safePage < totalPages ? (
              <Link
                href={`/schools/${slug}/instructors${href({ page: String(safePage + 1) })}`}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium"
              >
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
