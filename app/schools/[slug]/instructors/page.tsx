import Link from "next/link";
import { PendingLink } from "@/components/navigation/pending-link";
import { notFound } from "next/navigation";
import { CoverageBadge } from "@/components/coverage-badge";
import { SiteHeader } from "@/components/site-header";
import { getProfessorDirectoryRowsForSchool } from "@/lib/catalog";
import { getDirectorySchoolBySlug } from "@/lib/server-directory";
import { professorDepartmentSortKey, professorLastNameSortKey } from "@/lib/professor-sort";
import { slugify } from "@/lib/utils";
import type { ProfessorDirectoryRow } from "@/lib/types";
import {
  formatGpa,
  formatPercent,
  formatProfessorCoverageLevel,
  formatProfessorStatsAvailability,
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
    course?: string;
    q?: string;
    page?: string;
    evidence?: string;
    planning?: string;
    source?: string;
  }>;
};

type CatalogOffering = ProfessorDirectoryRow;

const instructorNumericSorters = {
  classify: (item: CatalogOffering) => item.classifyScore ?? -1,
  gpa: (item: CatalogOffering) => item.expectedGpa ?? -1,
  arate: (item: CatalogOffering) => item.aRate ?? -1,
  trend: (item: CatalogOffering) => item.trend.at(-1)?.classifyScore ?? item.classifyScore ?? -999,
  rating: (item: CatalogOffering) => item.rmpRating ?? -1,
};

type InstructorSortKey = "name" | "dept" | keyof typeof instructorNumericSorters;

const instructorSortKeys: InstructorSortKey[] = [
  "name",
  "dept",
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
  if (sortKey === "dept") {
    const d = professorDepartmentSortKey(left.departments).localeCompare(
      professorDepartmentSortKey(right.departments),
      undefined,
      { sensitivity: "base" },
    );
    if (d !== 0) return d;
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
    getProfessorDirectoryRowsForSchool(slug),
  ]);
  if (!school) notFound();

  const sortKey: InstructorSortKey =
    sp.sort && instructorSortKeys.includes(sp.sort as InstructorSortKey)
      ? (sp.sort as InstructorSortKey)
      : "name";
  const deptFilter = sp.dept?.trim() ?? "";
  const courseRaw = sp.course?.trim() ?? "";
  const courseFilter = courseRaw.toLowerCase();
  const q = sp.q?.trim().toLowerCase() ?? "";
  const evidenceFilter = sp.evidence?.trim() ?? "";
  const planningFilter = sp.planning?.trim() ?? "";
  const sourceFilter = sp.source?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  let rows = [...allRows];

  if (deptFilter) {
    rows = rows.filter((item) =>
      item.departments.some((department) => slugify(department) === deptFilter),
    );
  }
  if (courseFilter) {
    rows = rows.filter((item) => {
      const taught = item.coursesTaught ?? [];
      const fromTaught = taught.flatMap((c) => [c.courseCode, c.courseName]);
      const hay = [...item.courseCodes, ...fromTaught].join(" ").toLowerCase();
      return hay.includes(courseFilter);
    });
  }
  if (q) {
    rows = rows.filter((item) => {
      const taught = item.coursesTaught ?? [];
      const courseLabels = taught.map((c) => `${c.courseCode} ${c.courseName}`).join(" ");
      const hay =
        `${item.professorName} ${item.departments.join(" ")} ${item.coursePrefixes.join(" ")} ${item.courseCodes.join(" ")} ${courseLabels}`.toLowerCase();
      return hay.includes(q);
    });
  }
  if (evidenceFilter === "official") {
    rows = rows.filter((item) => item.hasInstitutionalStats);
  } else if (evidenceFilter === "mixed") {
    rows = rows.filter((item) => !item.hasInstitutionalStats && item.hasRmp);
  } else if (evidenceFilter === "limited") {
    rows = rows.filter((item) => !item.hasInstitutionalStats);
  }
  if (planningFilter === "schedule") {
    rows = rows.filter((item) => item.hasSchedulePresence);
  } else if (planningFilter === "catalog") {
    rows = rows.filter((item) => !item.hasSchedulePresence);
  }
  if (sourceFilter === "official") {
    rows = rows.filter((item) => item.sourceKinds.includes("official_grades"));
  } else if (sourceFilter === "rmp") {
    rows = rows.filter((item) => item.sourceKinds.includes("rmp"));
  } else if (sourceFilter === "schedule") {
    rows = rows.filter((item) => item.sourceKinds.includes("schedule"));
  } else if (sourceFilter === "identity") {
    rows = rows.filter(
      (item) =>
        !item.sourceKinds.includes("official_grades") &&
        !item.sourceKinds.includes("rmp") &&
        !item.sourceKinds.includes("schedule"),
    );
  }

  rows.sort((left, right) => compareInstructorRows(left, right, sortKey));

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  const departments = [
    ...new Set(allRows.flatMap((o) => o.departments)),
  ].sort((a, b) => a.localeCompare(b));

  const sortGroups = [
    {
      id: "browse",
      title: "Alphabetical",
      hint: "Sort by name or department",
      items: [
        ["name", "Last name"],
        ["dept", "Department"],
      ] as const satisfies readonly (readonly [InstructorSortKey, string])[],
    },
    {
      id: "metrics",
      title: "Outcomes & reviews",
      hint: "Higher values first when data exists",
      items: [
        ["classify", "Classify score"],
        ["gpa", "Expected GPA"],
        ["arate", "A-rate"],
        ["trend", "Trend"],
        ["rating", "RMP rating"],
      ] as const satisfies readonly (readonly [InstructorSortKey, string])[],
    },
  ] as const;

  const activeSortDescription: Record<InstructorSortKey, string> = {
    name: "Last name (A–Z)",
    dept: "Department, then last name",
    classify: "Classify score (highest first)",
    gpa: "Expected GPA (highest first)",
    arate: "A-rate (highest first)",
    trend: "Latest trend score (highest first)",
    rating: "RMP rating (highest first)",
  };

  function href(extra: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    p.set("sort", extra.sort ?? sortKey);
    if (extra.dept !== undefined ? extra.dept : deptFilter) {
      p.set("dept", (extra.dept !== undefined ? extra.dept : deptFilter) || "");
    }
    const courseVal = extra.course !== undefined ? extra.course : courseRaw;
    if (courseVal) {
      p.set("course", courseVal);
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
    if (extra.source !== undefined ? extra.source : sourceFilter) {
      p.set("source", (extra.source !== undefined ? extra.source : sourceFilter) || "");
    }
    const pg = extra.page ?? (safePage > 1 ? String(safePage) : "");
    if (pg && pg !== "1") p.set("page", pg);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10 pb-16 md:pb-10">
        <section className="soft-panel rounded-[28px] p-4 sm:rounded-[34px] sm:p-8">
          <p className="eyebrow">{school.shortName}</p>
          <h1 className="app-page-title mt-3 font-semibold text-ink">All instructors</h1>
          <p className="app-lead mt-4">
            Browse every professor identity we publish for this school ({total} total). Filter by
            department or class, sort by department or name, and scan the courses each instructor
            teaches next to their name.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/schools/${slug}`}
              className="inline-flex min-h-11 items-center justify-center touch-manipulation rounded-full border border-border px-4 py-2.5 text-sm font-medium text-ink sm:min-h-0 sm:py-2"
            >
              School hub
            </Link>
            <Link
              href={`/schools/${slug}/my-courses`}
              className="inline-flex min-h-11 items-center justify-center touch-manipulation rounded-full bg-deep-ink px-4 py-2.5 text-sm font-medium text-ivory sm:min-h-0 sm:py-2"
            >
              My courses
            </Link>
          </div>
        </section>

        <section className="search-elevated-surface mt-6 soft-panel rounded-[26px] p-4 sm:mt-8 sm:rounded-[30px] sm:p-6">
          <div className="max-w-2xl">
            <p className="eyebrow">Filters</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Narrow who appears in the list. Your sort choice below applies to the filtered results.
            </p>
          </div>
          <form
            className="mt-5 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end"
            action=""
            method="get"
          >
            <input type="hidden" name="sort" value={sortKey} />
            <label className="flex w-full min-w-0 flex-col gap-2 text-sm lg:w-auto lg:min-w-[12rem]">
              <span className="text-muted">Search</span>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Name, course prefix, department..."
                className="h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-strong/90 px-4 text-base outline-none sm:min-w-[14rem] sm:text-sm"
                autoComplete="off"
                enterKeyHint="search"
              />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-2 text-sm lg:w-auto lg:min-w-[12rem]">
              <span className="text-muted">Department</span>
              <select
                name="dept"
                defaultValue={deptFilter}
                className="h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-strong/90 px-4 text-base outline-none sm:min-w-[12rem] sm:text-sm"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={slugify(d)}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-full min-w-0 flex-col gap-2 text-sm lg:w-auto lg:min-w-[12rem]">
              <span className="text-muted">Class / course</span>
              <input
                name="course"
                defaultValue={sp.course ?? ""}
                placeholder="Code or title, e.g. CSCE 121"
                className="h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-strong/90 px-4 text-base outline-none sm:min-w-[14rem] sm:text-sm"
                autoComplete="off"
              />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-2 text-sm lg:w-auto lg:min-w-[11rem]">
              <span className="text-muted">Evidence</span>
              <select
                name="evidence"
                defaultValue={evidenceFilter}
                className="h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-strong/90 px-4 text-base outline-none sm:min-w-[11rem] sm:text-sm"
              >
                <option value="">All evidence</option>
                <option value="official">Institutional stats</option>
                <option value="mixed">RMP-backed only</option>
                <option value="limited">Identity only / thin stats</option>
              </select>
            </label>
            <label className="flex w-full min-w-0 flex-col gap-2 text-sm lg:w-auto lg:min-w-[11rem]">
              <span className="text-muted">Planning</span>
              <select
                name="planning"
                defaultValue={planningFilter}
                className="h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-strong/90 px-4 text-base outline-none sm:min-w-[11rem] sm:text-sm"
              >
                <option value="">All planning states</option>
                <option value="schedule">Section timing ready</option>
                <option value="catalog">Catalog only</option>
              </select>
            </label>
            <label className="flex w-full min-w-0 flex-col gap-2 text-sm lg:w-auto lg:min-w-[11rem]">
              <span className="text-muted">Source</span>
              <select
                name="source"
                defaultValue={sourceFilter}
                className="h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-strong/90 px-4 text-base outline-none sm:min-w-[11rem] sm:text-sm"
              >
                <option value="">All sources</option>
                <option value="official">Official outcomes</option>
                <option value="schedule">Schedule-linked</option>
                <option value="rmp">RMP-backed</option>
                <option value="identity">Identity only</option>
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex min-h-11 w-full items-center justify-center touch-manipulation rounded-full bg-deep-ink px-6 py-2.5 text-base font-medium text-ivory sm:w-auto sm:text-sm"
            >
              Apply filters
            </button>
          </form>

          <div
            className="mt-8 border-t border-border/70 pt-7"
            aria-labelledby="instructors-sort-heading"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1">
                <h2 id="instructors-sort-heading" className="eyebrow">
                  Sort order
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                  Pick one option. Browse keeps lists alphabetical; outcomes rank instructors by the
                  metric shown.
                </p>
              </div>
              <p className="w-full shrink-0 rounded-2xl border border-border/80 bg-surface-raised-top/70 px-4 py-3 text-sm text-muted sm:max-w-[min(100%,20rem)] sm:py-2.5">
                <span className="block text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
                  Active
                </span>
                <span className="mt-0.5 block break-words font-medium text-ink">
                  {activeSortDescription[sortKey]}
                </span>
              </p>
            </div>

            <div className="mt-6 space-y-5 sm:space-y-6">
              {sortGroups.map((group) => (
                <div
                  key={group.id}
                  role="group"
                  aria-label={group.title}
                  className="rounded-[20px] border border-border/60 bg-surface-raised-top/60 p-3.5 sm:rounded-[22px] sm:p-5"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                    <h3 className="text-sm font-semibold text-ink">{group.title}</h3>
                    <span className="text-sm leading-snug text-muted">{group.hint}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.items.map(([key, label]) => {
                      const active = sortKey === key;
                      return (
                        <Link
                          key={key}
                          href={`/schools/${slug}/instructors${href({ sort: key, page: "1" })}`}
                          className={`inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-ink active:opacity-90 ${
                            active
                              ? "border-deep-ink bg-deep-ink text-ivory shadow-sm"
                              : "border-border/90 bg-surface-strong/90 text-ink hover:border-border hover:bg-surface-raised-top dark:hover:bg-white/10"
                          }`}
                          aria-current={active ? "true" : undefined}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-3 sm:mt-8">
          {pageRows.length ? (
            pageRows.map((item) => (
              <div
                key={item.id}
                className="soft-panel flex flex-col gap-4 rounded-[22px] p-4 sm:rounded-[24px] md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink">{item.professorName}</h2>
                    <CoverageBadge tier={item.coverageTier} className="text-[0.62rem]" />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {item.departments.join(" • ") || "Department pending"}
                  </p>
                  <div className="mt-2">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
                      Classes taught
                    </p>
                    <ul className="mt-1.5 flex list-none flex-wrap gap-2">
                      {(item.coursesTaught?.length
                        ? item.coursesTaught
                        : item.courseCodes.map((code) => ({
                            courseCode: code,
                            courseName: "",
                          }))
                      ).map((c) => (
                        <li
                          key={`${item.id}-${c.courseCode}`}
                          className="max-w-full break-words rounded-2xl border border-border/80 bg-surface-raised-top/75 px-2.5 py-1.5 text-xs leading-snug text-ink"
                        >
                          <span className="font-semibold">{c.courseCode}</span>
                          {c.courseName ? (
                            <span className="text-muted"> — {c.courseName}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {!item.coursesTaught?.length && item.courseCodes.length === 0 ? (
                      <p className="mt-1 text-xs text-muted">Course list expanding from catalog</p>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-ink/78">{item.summary}</p>
                </div>
                <div className="flex min-w-0 shrink-0 flex-wrap gap-2 md:justify-end">
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
                    {item.hasSchedulePresence ? "Section timing ready" : "Directory only"}
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted">
                    {formatProfessorStatsAvailability(item.statsAvailability)}
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted">
                    {formatProfessorCoverageLevel(item.coverageLevel)}
                  </span>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto md:items-end">
                  <PendingLink
                    href={`/schools/${slug}/professors/${item.professorSlug}`}
                    className="min-h-11 touch-manipulation rounded-full bg-deep-ink px-4 py-2.5 text-base font-medium text-ivory sm:min-h-0 sm:py-2 sm:text-sm"
                  >
                    Profile
                  </PendingLink>
                  <Link
                    href={`/compare?ids=${item.id}`}
                    className="inline-flex min-h-11 items-center justify-center touch-manipulation rounded-full border border-border px-4 py-2.5 text-base font-medium text-ink sm:min-h-0 sm:py-2 sm:text-sm"
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
                : "This school page is live, but instructor identities have not been published locally yet. The directory fills in automatically once catalog or schedule data identifies faculty."}
            </div>
          )}
        </section>

        {totalPages > 1 ? (
          <nav
            className="mt-8 flex flex-col items-center gap-4"
            aria-label="Instructor list pagination"
          >
            <p className="text-center text-sm text-muted">
              Page {safePage} of {totalPages} · {total} instructors
            </p>
            <div className="flex w-full max-w-sm justify-center gap-3 sm:max-w-none">
              {safePage > 1 ? (
                <Link
                  href={`/schools/${slug}/instructors${href({ page: String(safePage - 1) })}`}
                  className="inline-flex min-h-11 min-w-[7rem] flex-1 items-center justify-center touch-manipulation rounded-full border border-border px-4 py-2.5 text-base font-medium sm:min-h-0 sm:flex-initial sm:px-5 sm:py-2 sm:text-sm"
                >
                  Previous
                </Link>
              ) : null}
              {safePage < totalPages ? (
                <Link
                  href={`/schools/${slug}/instructors${href({ page: String(safePage + 1) })}`}
                  className="inline-flex min-h-11 min-w-[7rem] flex-1 items-center justify-center touch-manipulation rounded-full border border-border px-4 py-2.5 text-base font-medium sm:min-h-0 sm:flex-initial sm:px-5 sm:py-2 sm:text-sm"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </div>
    </main>
  );
}
