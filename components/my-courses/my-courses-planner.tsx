"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown, Copy, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoverageBadge } from "@/components/coverage-badge";
import { useCombinedAuth } from "@/components/auth/use-combined-auth";
import {
  compareOfferings,
  offeringSortLabels,
  type OfferingSortKey,
} from "@/lib/offering-sort";
import {
  deletePlannerDraft,
  fetchPlannerDrafts,
  fetchShortlist,
  postPlannerDraft,
  putShortlist,
  type PlannerDraftRow,
} from "@/lib/me-api-client";
import { runDeferredNavigation } from "@/lib/deferred-navigation";
import type {
  CourseGroup,
  PlannerSolveResponse,
  ProfessorCourseSummary,
  RankingMode,
  SchoolSupportProfile,
  SectionRecord,
} from "@/lib/types";
import {
  formatConfidenceTone,
  formatEvidenceSource,
  formatFreshnessLabel,
  formatGpa,
  formatPercent,
  formatPlannerReadiness,
  formatRating,
  formatScore,
  formatSectionSchedule,
  scoreToLabel,
} from "@/lib/utils";
import { endClientMeasure, startClientMeasure } from "@/lib/client-performance";

const STORAGE_PREFIX = "classly:my-courses:";

type SectionSliceState = {
  loading: boolean;
  sections: SectionRecord[];
  error: string | null;
};

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

function rankingModeFromSortKey(sortKey: OfferingSortKey): RankingMode {
  switch (sortKey) {
    case "gpa":
    case "arate":
      return "expected_gpa";
    case "rating":
      return "ease_score";
    default:
      return "planner_fit";
  }
}

function sortKeyFromRankingMode(rankingMode: RankingMode): OfferingSortKey {
  switch (rankingMode) {
    case "expected_gpa":
      return "gpa";
    case "ease_score":
      return "rating";
    default:
      return "classify";
  }
}

function buildShareHref(pathname: string, searchParams: URLSearchParams, slugs: string[]) {
  const params = new URLSearchParams(searchParams.toString());
  if (slugs.length) {
    params.set("courses", slugs.join(","));
  } else {
    params.delete("courses");
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function MyCoursesPlanner({
  schoolSlug,
  courseGroups,
  offeringsByCourseSlug,
  initialCoursesFromUrl,
  supportProfile,
}: {
  schoolSlug: string;
  courseGroups: CourseGroup[];
  offeringsByCourseSlug: Record<string, ProfessorCourseSummary[]>;
  initialCoursesFromUrl: string[];
  supportProfile?: SchoolSupportProfile;
}) {
  const { supabaseUserId, user } = useCombinedAuth();
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
  const [plannerResult, setPlannerResult] = useState<PlannerSolveResponse | null>(null);
  const [plannerBusy, setPlannerBusy] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [sectionSlices, setSectionSlices] = useState<Record<string, SectionSliceState>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<PlannerDraftRow[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftTermLabel, setDraftTermLabel] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftToLoad, setDraftToLoad] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const rootRef = useRef<HTMLDivElement>(null);
  const recommendationsRef = useRef<HTMLElement>(null);
  const cloudSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTriedRef = useRef(false);

  useEffect(() => {
    if (!openSuggest) return;
    const close = () => setOpenSuggest(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [openSuggest]);
  const rankingMode = rankingModeFromSortKey(sortKey);
  const coursesParam = searchParams.get("courses");

  const syncUrl = useCallback(
    (slugs: string[]) => {
      const url = buildShareHref(pathname, new URLSearchParams(searchParams.toString()), slugs);
      runDeferredNavigation(() => {
        router.replace(url, { scroll: false });
      });
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
      if (supabaseUserId) {
        if (cloudSyncTimer.current) clearTimeout(cloudSyncTimer.current);
        cloudSyncTimer.current = setTimeout(() => {
          void putShortlist(schoolSlug, next);
        }, 650);
      }
    },
    [filterValid, schoolSlug, supabaseUserId, syncUrl],
  );

  const scheduleSelectedSlugs = useCallback((next: string[]) => {
    queueMicrotask(() => setSelectedSlugs(next));
  }, []);

  useEffect(() => {
    localTriedRef.current = false;
  }, [schoolSlug]);

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

    let cancelled = false;

    void (async () => {
      if (supabaseUserId) {
        try {
          const data = await fetchShortlist(schoolSlug);
          if (cancelled) return;
          const cloud = filterValid(data?.courseSlugs ?? []);
          if (cloud.length > 0) {
            scheduleSelectedSlugs(cloud);
            syncUrl(cloud);
            try {
              localStorage.setItem(storageKey(schoolSlug), JSON.stringify(cloud));
            } catch {
              /* ignore */
            }
            return;
          }
        } catch {
          /* offline */
        }
      }

      if (cancelled || localTriedRef.current) return;
      localTriedRef.current = true;

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
    })();

    return () => {
      cancelled = true;
    };
  }, [coursesParam, filterValid, scheduleSelectedSlugs, schoolSlug, supabaseUserId, syncUrl]);

  useEffect(() => {
    return () => {
      if (cloudSyncTimer.current) clearTimeout(cloudSyncTimer.current);
    };
  }, []);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenSuggest(false);
      }
    }

    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    if (!selectedSlugs.length) {
      setPlannerResult(null);
      setPlannerError(null);
      setPlannerBusy(false);
      return;
    }

    const params = new URLSearchParams({
      schoolSlug,
      rankingMode,
      courseSlugs: selectedSlugs.join(","),
    });

    setPlannerBusy(true);
    setPlannerError(null);
    startClientMeasure(`planner-bootstrap:${schoolSlug}`, "planner_bootstrap_latency", {
      school_slug: schoolSlug,
      course_count: selectedSlugs.length,
      ranking_mode: rankingMode,
    });

    fetch(`/api/planner/solve?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | PlannerSolveResponse
          | { error?: string }
          | null;

        if (
          !response.ok ||
          !payload ||
          ("error" in payload && typeof payload.error === "string")
        ) {
          throw new Error(
            (payload && "error" in payload ? payload.error : null) ?? "planner_unavailable",
          );
        }

        if (!cancelled) {
          setPlannerResult(payload as PlannerSolveResponse);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || String(error).includes("AbortError")) {
          return;
        }
        if (!cancelled) {
          setPlannerResult(null);
          setPlannerError(String(error));
        }
      })
      .finally(() => {
        void endClientMeasure(`planner-bootstrap:${schoolSlug}`, {
          school_slug: schoolSlug,
          course_count: selectedSlugs.length,
          ranking_mode: rankingMode,
        });
        if (!cancelled) {
          setPlannerBusy(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [rankingMode, schoolSlug, selectedSlugs]);

  useEffect(() => {
    if (!supabaseUserId) {
      setDrafts([]);
      return;
    }

    let cancelled = false;
    void fetchPlannerDrafts(schoolSlug)
      .then((data) => {
        if (!cancelled) {
          setDrafts(data?.drafts ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDrafts([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [schoolSlug, supabaseUserId]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const already = new Set(selectedSlugs);
    return courseGroups
      .filter((course) => !already.has(course.courseSlug))
      .filter((course) => {
        if (!q) return true;
        const hay = `${course.courseCode} ${course.courseName} ${course.department}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [courseGroups, query, selectedSlugs]);

  const selectedMeta = useMemo(() => {
    const map = new Map(courseGroups.map((course) => [course.courseSlug, course] as const));
    return selectedSlugs.map((slug) => map.get(slug)).filter(Boolean) as CourseGroup[];
  }, [courseGroups, selectedSlugs]);

  const selectedCourseLookup = useMemo(
    () => new Map(selectedMeta.map((course) => [course.courseSlug, course] as const)),
    [selectedMeta],
  );

  const coursePanels = useMemo(
    () =>
      selectedMeta.map((course) => ({
        course,
        offerings: [...(offeringsByCourseSlug[course.courseSlug] ?? [])].sort((left, right) =>
          compareOfferings(left, right, sortKey),
        ),
      })),
    [offeringsByCourseSlug, selectedMeta, sortKey],
  );

  const selectionLookup = useMemo(
    () =>
      new Map(
        (plannerResult?.selections ?? []).map((selection) => [selection.courseSlug, selection] as const),
      ),
    [plannerResult],
  );

  function addCourse(courseSlug: string) {
    if (!validSlugSet.has(courseSlug) || selectedSlugs.includes(courseSlug)) return;
    persistAndRoute([...selectedSlugs, courseSlug]);
    setQuery("");
    setOpenSuggest(false);
  }

  function removeCourse(courseSlug: string) {
    persistAndRoute(selectedSlugs.filter((slug) => slug !== courseSlug));
    setExpandedSections((current) => ({ ...current, [courseSlug]: false }));
  }

  async function toggleSections(courseSlug: string) {
    setExpandedSections((current) => ({ ...current, [courseSlug]: !current[courseSlug] }));

    if (sectionSlices[courseSlug]?.loading || sectionSlices[courseSlug]?.sections.length) {
      return;
    }

    setSectionSlices((current) => ({
      ...current,
      [courseSlug]: { loading: true, sections: [], error: null },
    }));
    startClientMeasure(`planner-sections:${schoolSlug}:${courseSlug}`, "planner_section_slice_latency", {
      school_slug: schoolSlug,
      course_slug: courseSlug,
    });

    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolSlug)}/sections?courseSlug=${encodeURIComponent(courseSlug)}`,
      );
      const payload = (await response.json().catch(() => null)) as {
        sections?: SectionRecord[];
        error?: string;
      } | null;

      if (!response.ok || !Array.isArray(payload?.sections)) {
        throw new Error(payload?.error ?? "sections_unavailable");
      }

      setSectionSlices((current) => ({
        ...current,
        [courseSlug]: { loading: false, sections: payload.sections ?? [], error: null },
      }));
    } catch (error: unknown) {
      setSectionSlices((current) => ({
        ...current,
        [courseSlug]: {
          loading: false,
          sections: [],
          error: String(error),
        },
      }));
    } finally {
      void endClientMeasure(`planner-sections:${schoolSlug}:${courseSlug}`, {
        school_slug: schoolSlug,
        course_slug: courseSlug,
      });
    }
  }

  async function saveDraft() {
    if (!supabaseUserId || !selectedSlugs.length) {
      return;
    }

    setDraftBusy(true);
    try {
      const result = await postPlannerDraft({
        schoolSlug,
        courseSlugs: selectedSlugs,
        rankingMode,
        name: draftName.trim() || undefined,
        termLabel: draftTermLabel.trim() || undefined,
      });

      if (result) {
        setDrafts((current) => [result.draft, ...current.filter((draft) => draft.id !== result.draft.id)]);
        setDraftName("");
        setDraftTermLabel("");
      }
    } finally {
      setDraftBusy(false);
    }
  }

  function loadDraft() {
    const draft = drafts.find((item) => item.id === draftToLoad);
    if (!draft) {
      return;
    }

    setSortKey(sortKeyFromRankingMode(draft.ranking_mode));
    persistAndRoute(draft.course_slugs);
    setDraftToLoad("");
  }

  async function removeDraft(id: string) {
    await deletePlannerDraft(id);
    setDrafts((current) => current.filter((draft) => draft.id !== id));
    if (draftToLoad === id) {
      setDraftToLoad("");
    }
  }

  async function copyShareLink() {
    try {
      const href = buildShareHref(pathname, new URLSearchParams(searchParams.toString()), selectedSlugs);
      const url = `${window.location.origin}${href}`;
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1500);
    }
  }

  function jumpToRecommendations() {
    recommendationsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div ref={rootRef} className="space-y-8">
      <section className="search-elevated-surface soft-panel rounded-[30px] p-5 sm:p-6">
        <p className="eyebrow">Add courses</p>
        <p className="mt-2 text-sm text-muted">
          Search by course code or title. Lists sync to your account when you sign in with email.
          Share links keep the same shortlist without an account.
        </p>
        {user?.source === "firebase" && !supabaseUserId ? (
          <p className="mt-2 text-xs text-muted">
            Cloud saves use the email-link Classify account flow. If you only used Google sign-in,
            this shortlist still stays local to this browser until you add an email-link session.
          </p>
        ) : null}
        {supportProfile ? (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            <span className="rounded-full border border-border bg-background px-3 py-1.5">
              {formatPlannerReadiness(supportProfile.plannerReadiness)}
            </span>
            {supportProfile.sourceAvailability.map((item) => (
              <span
                key={item}
                className="rounded-full border border-border bg-background px-3 py-1.5"
              >
                {formatEvidenceSource(item)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="relative z-10 mt-4 max-w-xl">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpenSuggest(true);
            }}
            onFocus={() => setOpenSuggest(true)}
            placeholder="e.g. CSCE 181 or Data Science"
            disabled={!courseGroups.length}
            className="relative z-0 h-11 w-full rounded-2xl border border-border bg-white/80 px-4 outline-none"
            autoComplete="off"
          />
          {openSuggest && suggestions.length > 0 ? (
            <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-border bg-background py-1 shadow-[0_20px_48px_rgba(7,17,31,0.14)]">
              {suggestions.map((course) => (
                <li key={course.courseSlug}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm hover:bg-white/80"
                    onClick={() => addCourse(course.courseSlug)}
                  >
                    <span className="font-semibold text-ink">{course.courseCode}</span>
                    <span className="text-muted"> - {course.courseName}</span>
                    <span className="mt-0.5 block text-xs text-muted">{course.department}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {selectedMeta.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {selectedMeta.map((course) => (
              <span
                key={course.courseSlug}
                className="inline-flex items-center gap-2 rounded-full classify-chip-surface px-3 py-1.5 text-sm"
              >
                <Link
                  href={`/schools/${schoolSlug}/courses/${course.courseSlug}`}
                  className="font-medium text-ink hover:underline"
                >
                  {course.courseCode}
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${course.courseCode}`}
                  className="rounded-full px-1.5 text-muted hover:bg-background hover:text-ink"
                  onClick={() => removeCourse(course.courseSlug)}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {selectedSlugs.length ? (
        <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={() => void copyShareLink()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full classify-chip-surface px-4 py-2 text-sm font-medium text-ink"
            >
              <Copy className="h-4 w-4" />
              {copyState === "copied" ? "Link copied" : copyState === "error" ? "Copy failed" : "Copy share link"}
            </button>
            <Link
              href={`/schools/${schoolSlug}/instructors`}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-ink"
            >
              Browse all instructors
            </Link>
          </div>
        ) : null}
      </section>

      {selectedSlugs.length === 0 ? (
        <div className="soft-panel rounded-[26px] border border-dashed border-border px-6 py-14 text-center text-sm text-muted">
          {courseGroups.length ? (
            <>No courses yet. Add one above to build a shortlist, compare instructors, and preview sections.</>
          ) : (
            <>This school profile is live, but its local course catalog has not been published yet. The planner will deepen as catalog and schedule imports land.</>
          )}
        </div>
      ) : (
        <>
          <section ref={recommendationsRef} className="soft-panel rounded-[30px] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Planner recommendations</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">
                  Section-aware picks for this shortlist
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Rankings stay aligned with your current sort mode. When meeting-time coverage is
                  weak, Classify falls back to the best published instructor row instead of hiding
                  the course.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                <span className="rounded-full classify-chip-surface px-3 py-1.5">
                  {formatPlannerReadiness(supportProfile?.plannerReadiness ?? "directory_ready")}
                </span>
                <span className="rounded-full classify-chip-surface px-3 py-1.5">
                  Updated {plannerResult ? formatFreshnessLabel(plannerResult.updatedAt) : "Loading"}
                </span>
              </div>
            </div>

            {supabaseUserId ? (
              <div className="mt-5 rounded-[24px] border border-border/80 bg-white/60 p-4">
                <p className="text-sm font-medium text-ink">Save planner draft</p>
                <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
                  <label className="flex-1 text-sm">
                    <span className="text-muted">Draft name</span>
                    <input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      placeholder="e.g. Spring shortlist"
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 outline-none"
                    />
                  </label>
                  <label className="flex-1 text-sm">
                    <span className="text-muted">Term label</span>
                    <input
                      value={draftTermLabel}
                      onChange={(event) => setDraftTermLabel(event.target.value)}
                      placeholder="e.g. Fall 2026"
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveDraft()}
                    disabled={draftBusy || !selectedSlugs.length}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-deep-ink px-5 text-sm font-semibold text-ivory disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {draftBusy ? "Saving..." : "Save draft"}
                  </button>
                </div>

                {drafts.length ? (
                  <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
                    <label className="flex-1 text-sm">
                      <span className="text-muted">Load saved draft</span>
                      <select
                        value={draftToLoad}
                        onChange={(event) => setDraftToLoad(event.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 outline-none"
                      >
                        <option value="">Choose a draft...</option>
                        {drafts.map((draft) => (
                          <option key={draft.id} value={draft.id}>
                            {draft.name}{draft.term_label ? ` (${draft.term_label})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={!draftToLoad}
                      onClick={loadDraft}
                      className="h-10 rounded-full border border-border bg-white px-4 text-sm font-medium text-ink disabled:opacity-50"
                    >
                      Load
                    </button>
                    {draftToLoad ? (
                      <button
                        type="button"
                        onClick={() => void removeDraft(draftToLoad)}
                        className="h-10 rounded-full border border-border bg-white px-4 text-sm font-medium text-ink"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {plannerBusy ? (
              <div className="mt-5 rounded-[24px] classify-inner px-4 py-10 text-sm text-muted">
                Building planner recommendations...
              </div>
            ) : plannerError ? (
              <div className="mt-5 rounded-[24px] border border-copper/40 bg-copper/10 px-4 py-6 text-sm text-ink">
                Planner recommendations are temporarily unavailable. The shortlist below still works.
              </div>
            ) : plannerResult ? (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {plannerResult.selections.map((selection) => {
                  const course = selectedCourseLookup.get(selection.courseSlug);
                  const sectionState = sectionSlices[selection.courseSlug];
                  const expanded = Boolean(expandedSections[selection.courseSlug]);

                  return (
                    <article
                      key={selection.courseSlug}
                      className="rounded-[24px] border border-border/80 bg-white/72 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">
                            {course?.courseCode ?? selection.courseSlug}
                          </p>
                          <p className="text-sm text-muted">
                            {course?.courseName ?? "Course shortlist item"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void toggleSections(selection.courseSlug)}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-ink"
                        >
                          Section options
                          <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />
                        </button>
                      </div>

                      <div className="mt-4 rounded-[20px] bg-background px-4 py-4">
                        {selection.section ? (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-ink">
                                  {selection.section.professorName ?? "Instructor TBD"}
                                </p>
                                <p className="text-xs text-muted">
                                  {selection.section.term} - {formatSectionSchedule(
                                    selection.section.days,
                                    selection.section.startTime,
                                    selection.section.endTime,
                                  )}
                                </p>
                              </div>
                              <span className="rounded-full border border-border bg-white px-3 py-1 text-xs text-muted">
                                {formatConfidenceTone(selection.section.evidenceProfile.confidenceLabel)}
                              </span>
                            </div>
                            <p className="mt-3 text-xs text-muted">
                              {selection.section.hasMeetingTime
                                ? "Recommended because it fits the current shortlist without a known conflict."
                                : "Best instructor row available right now. Meeting time has not been published yet."}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted">
                            No section or instructor row is published yet for this course.
                          </p>
                        )}
                      </div>

                      {expanded ? (
                        <div className="classify-inner mt-4 rounded-[20px] p-4">
                          {sectionState?.loading ? (
                            <p className="text-sm text-muted">Loading sections...</p>
                          ) : sectionState?.error ? (
                            <p className="text-sm text-muted">
                              Could not load sections right now.
                            </p>
                          ) : sectionState?.sections.length ? (
                            <div className="space-y-3">
                              {sectionState.sections.map((section) => (
                                <div
                                  key={section.id}
                                  className="rounded-[18px] border border-border/70 bg-background px-3 py-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-ink">
                                        {section.professorName ?? "Instructor TBD"}
                                      </p>
                                      <p className="text-xs text-muted">
                                        {section.term} - {formatSectionSchedule(
                                          section.days,
                                          section.startTime,
                                          section.endTime,
                                        )}
                                      </p>
                                    </div>
                                    <span className="rounded-full border border-border bg-white px-2.5 py-1 text-[0.7rem] text-muted">
                                      {section.id === selection.section?.id ? "Recommended" : section.rankingMode.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted">
                              No section-level timing has been published for this course yet.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : null}

            {plannerResult?.warnings.length ? (
              <div className="mt-5 space-y-2">
                {plannerResult.warnings.map((warning) => (
                  <p
                    key={warning}
                    className="rounded-[18px] border border-copper/30 bg-copper/10 px-4 py-3 text-sm text-ink"
                  >
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
          </section>

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
                      : "classify-chip-surface text-ink hover:bg-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="mb-4 text-sm text-muted">
              {selectedSlugs.length} selected course{selectedSlugs.length === 1 ? "" : "s"}.
              Instructor rows stay grouped by course so planning decisions remain course-first.
            </p>

            <div className="space-y-5">
              {coursePanels.map(({ course, offerings }) => (
                <article
                  key={course.courseSlug}
                  className="rounded-[26px] classify-inner p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-ink">
                        {course.courseCode} - {course.courseName}
                      </h2>
                      <p className="mt-1 text-sm text-muted">{course.department}</p>
                    </div>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      {selectionLookup.get(course.courseSlug)?.section?.hasMeetingTime ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1.5 text-xs text-muted">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Schedule ready
                        </span>
                      ) : null}
                      <Link
                        href={`/schools/${schoolSlug}/courses/${course.courseSlug}`}
                          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-ink sm:w-auto"
                      >
                        Open course page
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {offerings.length ? (
                      offerings.map((item) => (
                        <div
                          key={item.id}
                          className="grid gap-4 rounded-[22px] border border-border/70 bg-background px-4 py-4 lg:grid-cols-[1.08fr_0.92fr_auto]"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-ink">{item.professorName}</h3>
                              <CoverageBadge tier={item.coverageTier} className="text-[0.62rem]" />
                            </div>
                            <p className="mt-1 text-sm text-muted">{item.professorSummary}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                              <span className="rounded-full border border-border bg-white px-3 py-1.5">
                                Freshness {formatFreshnessLabel(item.freshness)}
                              </span>
                              <span className="rounded-full border border-border bg-white px-3 py-1.5">
                                {item.hasSectionPlanning ? "Section timing ready" : "Catalog only"}
                              </span>
                            </div>
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

                          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-end">
                            <Link
                              href={`/schools/${schoolSlug}/professors/${item.professorSlug}`}
                              className="inline-flex min-h-11 items-center justify-center rounded-full bg-deep-ink px-4 py-2 text-sm font-medium text-ivory"
                            >
                              Open profile
                            </Link>
                            <Link
                              href={`/compare?ids=${encodeURIComponent(item.id)}&school=${encodeURIComponent(item.schoolSlug)}`}
                              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-ink"
                            >
                              Compare
                            </Link>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-border px-4 py-10 text-sm text-muted">
                        No published instructor rows are attached to this course yet.
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {selectedSlugs.length ? (
        <div
          className="soft-panel fixed inset-x-3 z-20 rounded-[24px] border border-border/80 p-3 md:hidden"
          style={{ bottom: "calc(var(--mobile-nav-height) + var(--safe-bottom) + 0.75rem)" }}
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void copyShareLink()}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/78 px-3 text-sm font-medium text-ink"
            >
              {copyState === "copied"
                ? "Link copied"
                : copyState === "error"
                  ? "Copy failed"
                  : "Share"}
            </button>
            {supabaseUserId ? (
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={draftBusy || !selectedSlugs.length}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-deep-ink px-3 text-sm font-semibold text-ivory disabled:opacity-50"
              >
                {draftBusy ? "Saving..." : "Save"}
              </button>
            ) : (
              <Link
                href="/login"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/78 px-3 text-sm font-medium text-ink"
              >
                Sign in
              </Link>
            )}
            <button
              type="button"
              onClick={jumpToRecommendations}
                className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/78 px-3 text-sm font-medium text-ink"
              >
                View picks
              </button>
          </div>
        </div>
      ) : null}
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
    <div className="classify-well rounded-2xl px-4 py-3 text-sm">
      <span className="text-muted">{label}</span>
      <p className="mt-1 font-semibold text-ink">{value}</p>
      {meta ? <p className="mt-1 text-xs text-muted">{meta}</p> : null}
    </div>
  );
}
