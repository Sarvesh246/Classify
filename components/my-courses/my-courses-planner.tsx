"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoverageBadge } from "@/components/coverage-badge";
import { offeringSortLabels, offeringSorters, type OfferingSortKey } from "@/lib/offering-sort";
import type { CourseGroup, ProfessorCourseSummary } from "@/lib/types";
import {
  formatGpa,
  formatPercent,
  formatRating,
  formatScore,
  scoreToLabel,
} from "@/lib/utils";

const STORAGE_PREFIX = "classly:my-courses:";

function storageKey(schoolSlug: string) {
  return `${STORAGE_PREFIX}${schoolSlug}`;
}

function parseCoursesParam(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function MyCoursesPlanner({
  schoolSlug,
  courseGroups,
  offeringsByCourseSlug,
  initialCoursesFromUrl,
}: {
  schoolSlug: string;
  courseGroups: CourseGroup[];
  offeringsByCourseSlug: Record<string, ProfessorCourseSummary[]>;
  initialCoursesFromUrl: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const validSlugSet = useMemo(
    () => new Set(Object.keys(offeringsByCourseSlug)),
    [offeringsByCourseSlug],
  );

  const filterValid = useCallback(
    (slugs: string[]) => [...new Set(slugs.filter((s) => validSlugSet.has(s)))],
    [validSlugSet],
  );

  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() =>
    filterValid(initialCoursesFromUrl),
  );
  const [sortKey, setSortKey] = useState<OfferingSortKey>("classify");
  const [query, setQuery] = useState("");
  const [openSuggest, setOpenSuggest] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const syncUrl = useCallback(
    (slugs: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (slugs.length) {
        params.set("courses", slugs.join(","));
      } else {
        params.delete("courses");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const persistAndRoute = useCallback(
    (slugs: string[]) => {
      const next = filterValid(slugs);
      setSelectedSlugs(next);
      try {
        localStorage.setItem(storageKey(schoolSlug), JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      syncUrl(next);
    },
    [filterValid, schoolSlug, syncUrl],
  );

  const lsHydrated = useRef(false);
  const scheduleSelectedSlugs = useCallback((next: string[]) => {
    queueMicrotask(() => setSelectedSlugs(next));
  }, []);
  const coursesParam = searchParams.get("courses");
  useEffect(() => {
    const fromUrl = filterValid(parseCoursesParam(coursesParam));
    if (fromUrl.length > 0) {
      scheduleSelectedSlugs(fromUrl);
      try {
        localStorage.setItem(storageKey(schoolSlug), JSON.stringify(fromUrl));
      } catch {
        /* ignore */
      }
      return;
    }

    if (lsHydrated.current) return;
    lsHydrated.current = true;
    try {
      const raw = localStorage.getItem(storageKey(schoolSlug));
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const fromStore = filterValid(parsed.filter((x) => typeof x === "string"));
      if (fromStore.length) {
        scheduleSelectedSlugs(fromStore);
        syncUrl(fromStore);
      }
    } catch {
      /* ignore */
    }
  }, [coursesParam, filterValid, scheduleSelectedSlugs, schoolSlug, syncUrl]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpenSuggest(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const already = new Set(selectedSlugs);
    return courseGroups
      .filter((c) => !already.has(c.courseSlug))
      .filter((c) => {
        if (!q) return true;
        const hay = `${c.courseCode} ${c.courseName} ${c.department}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [courseGroups, query, selectedSlugs]);

  const combinedRows = useMemo(() => {
    const rows: ProfessorCourseSummary[] = [];
    for (const slug of selectedSlugs) {
      const chunk = offeringsByCourseSlug[slug];
      if (chunk?.length) rows.push(...chunk);
    }
    return [...rows].sort(
      (left, right) => offeringSorters[sortKey](right) - offeringSorters[sortKey](left),
    );
  }, [offeringsByCourseSlug, selectedSlugs, sortKey]);

  function addCourse(courseSlug: string) {
    if (!validSlugSet.has(courseSlug) || selectedSlugs.includes(courseSlug)) return;
    persistAndRoute([...selectedSlugs, courseSlug]);
    setQuery("");
    setOpenSuggest(false);
  }

  function removeCourse(courseSlug: string) {
    persistAndRoute(selectedSlugs.filter((s) => s !== courseSlug));
  }

  const selectedMeta = useMemo(() => {
    const map = new Map(courseGroups.map((c) => [c.courseSlug, c] as const));
    return selectedSlugs.map((s) => map.get(s)).filter(Boolean) as CourseGroup[];
  }, [courseGroups, selectedSlugs]);

  return (
    <div ref={rootRef} className="space-y-8">
      <section className="soft-panel rounded-[30px] p-5 sm:p-6">
        <p className="eyebrow">Add courses</p>
        <p className="mt-2 text-sm text-muted">
          Search by course code or title. Your list is saved in this browser and can be shared via
          the URL.
        </p>
        <div className="relative mt-4 max-w-xl">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenSuggest(true);
            }}
            onFocus={() => setOpenSuggest(true)}
            placeholder="e.g. CSCE 181 or Data Science"
            className="h-11 w-full rounded-2xl border border-border bg-white/80 px-4 outline-none"
            autoComplete="off"
          />
          {openSuggest && suggestions.length > 0 ? (
            <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-border bg-background py-1 shadow-lg">
              {suggestions.map((c) => (
                <li key={c.courseSlug}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm hover:bg-white/80"
                    onClick={() => addCourse(c.courseSlug)}
                  >
                    <span className="font-semibold text-ink">{c.courseCode}</span>
                    <span className="text-muted"> — {c.courseName}</span>
                    <span className="mt-0.5 block text-xs text-muted">{c.department}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {selectedMeta.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {selectedMeta.map((c) => (
              <span
                key={c.courseSlug}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white/72 px-3 py-1.5 text-sm"
              >
                <Link
                  href={`/schools/${schoolSlug}/courses/${c.courseSlug}`}
                  className="font-medium text-ink hover:underline"
                >
                  {c.courseCode}
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${c.courseCode}`}
                  className="rounded-full px-1.5 text-muted hover:bg-background hover:text-ink"
                  onClick={() => removeCourse(c.courseSlug)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {selectedSlugs.length === 0 ? (
        <div className="soft-panel rounded-[26px] border border-dashed border-border px-6 py-14 text-center text-sm text-muted">
          No courses yet. Add one above to see every instructor row we publish for that catalog
          entry, sorted together.
        </div>
      ) : (
        <section className="soft-panel rounded-[30px] p-5 sm:p-6">
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

          <p className="mb-4 text-sm text-muted">
            {combinedRows.length} instructor row
            {combinedRows.length === 1 ? "" : "s"} across {selectedSlugs.length} course
            {selectedSlugs.length === 1 ? "" : "s"}.
          </p>

          <div className="space-y-3">
            {combinedRows.map((item) => (
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
                    <Link
                      href={`/schools/${schoolSlug}/courses/${item.courseSlug}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {item.courseCode}
                    </Link>{" "}
                    — {item.courseName}
                  </p>
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
                    className="rounded-full bg-deep-ink px-4 py-2 text-center text-sm font-medium text-ivory"
                  >
                    Open profile
                  </Link>
                  <Link
                    href={`/compare?ids=${encodeURIComponent(item.id)}&school=${encodeURIComponent(item.schoolSlug)}`}
                    className="rounded-full border border-border px-4 py-2 text-center text-sm font-medium text-ink"
                    >
                    Compare
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
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
