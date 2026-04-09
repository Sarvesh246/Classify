"use client";

import Link from "next/link";
import { PendingLink } from "@/components/navigation/pending-link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Plus, School, X } from "lucide-react";
import { CoverageBadge } from "@/components/coverage-badge";
import { TrendSparkline } from "@/components/charts/trend-sparkline";
import { metricHasTrend } from "@/components/charts/metric-trend-chart";
import { useCombinedAuth } from "@/components/auth/use-combined-auth";
import { MobileSheet } from "@/components/mobile/mobile-sheet";
import { SearchCombobox } from "@/components/search/search-combobox";
import {
  type CoverageTier,
  type ProfessorCourseSummary,
  type SearchHit,
} from "@/lib/types";
import { runDeferredNavigation } from "@/lib/deferred-navigation";
import {
  fetchCompareSets,
  postCompareSet,
  type CompareSetRow,
} from "@/lib/me-api-client";
import {
  confidenceToLabel,
  formatFreshnessLabel,
  formatGpa,
  formatPercent,
  formatRating,
  formatScore,
  scoreToLabel,
} from "@/lib/utils";
import { endClientMeasure, startClientMeasure } from "@/lib/client-performance";
import { offeringHasInstitutionalGradeEvidence } from "@/lib/data-trust";

interface CompareBuilderProps {
  catalog: ProfessorCourseSummary[];
  initialSelectedIds: string[];
  initialSchoolSlug?: string;
}

export function CompareBuilder({
  catalog,
  initialSelectedIds,
  initialSchoolSlug,
}: CompareBuilderProps) {
  const { supabaseUserId } = useCombinedAuth();
  const pathname = usePathname();
  const router = useRouter();
  const initialSelectedSchool =
    catalog.find((item) => initialSelectedIds.includes(item.id)) ?? null;
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds.slice(0, 4));
  const [activeSchoolSlug, setActiveSchoolSlug] = useState(
    initialSchoolSlug ?? initialSelectedSchool?.schoolSlug,
  );
  const [activeSchoolMeta, setActiveSchoolMeta] = useState<{
    name?: string;
    coverageTier?: CoverageTier;
  }>({
    name: initialSelectedSchool?.schoolName,
    coverageTier: initialSelectedSchool?.coverageTier,
  });
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [activeCourseSlug, setActiveCourseSlug] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [, startTransition] = useTransition();
  const [compareSets, setCompareSets] = useState<CompareSetRow[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [loadSetId, setLoadSetId] = useState("");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (builderOpen) {
      void endClientMeasure("compare-builder-open", {
        mobile: isMobile,
        school_slug: activeSchoolSlug ?? "",
      });
    }
  }, [activeSchoolSlug, builderOpen, isMobile]);

  useEffect(() => {
    if (catalogOpen) {
      void endClientMeasure("compare-catalog-open", {
        mobile: isMobile,
        school_slug: activeSchoolSlug ?? "",
      });
    }
  }, [activeSchoolSlug, catalogOpen, isMobile]);

  useEffect(() => {
    if (!supabaseUserId) return;
    let cancelled = false;
    void fetchCompareSets().then((d) => {
      if (!cancelled && d) setCompareSets(d.sets);
    });
    return () => {
      cancelled = true;
    };
  }, [supabaseUserId]);

  useEffect(() => {
    if (!(isMobile && (catalogOpen || builderOpen))) {
      return;
    }

    const scrollY = window.scrollY;
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const bodyPosition = document.body.style.position;
    const bodyTop = document.body.style.top;
    const bodyWidth = document.body.style.width;
    const bodyTouchAction = document.body.style.touchAction;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.touchAction = "none";

    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      document.body.style.position = bodyPosition;
      document.body.style.top = bodyTop;
      document.body.style.width = bodyWidth;
      document.body.style.touchAction = bodyTouchAction;
      window.scrollTo(0, scrollY);
    };
  }, [builderOpen, catalogOpen, isMobile]);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => catalog.find((item) => item.id === id))
        .filter((item): item is ProfessorCourseSummary => item != null),
    [catalog, selectedIds],
  );

  const schoolOptions = useMemo(() => {
    const seen = new Set<string>();
    return catalog.filter((item) => {
      if (seen.has(item.schoolSlug)) return false;
      seen.add(item.schoolSlug);
      return true;
    });
  }, [catalog]);

  const activeSchool =
    schoolOptions.find((item) => item.schoolSlug === activeSchoolSlug) ??
    selected.find((item) => item.schoolSlug === activeSchoolSlug);

  const courseOptions = useMemo(() => {
    const seen = new Map<string, { courseSlug: string; label: string }>();
    for (const item of catalog) {
      if (activeSchoolSlug && item.schoolSlug !== activeSchoolSlug) {
        continue;
      }
      if (!seen.has(item.courseSlug)) {
        seen.set(item.courseSlug, {
          courseSlug: item.courseSlug,
          label: `${item.courseCode} - ${item.courseName}`,
        });
      }
    }
    return [...seen.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [activeSchoolSlug, catalog]);

  const visibleCatalog = useMemo(() => {
    return [...catalog]
      .filter((item) => !activeSchoolSlug || item.schoolSlug === activeSchoolSlug)
      .filter((item) => !activeCourseSlug || item.courseSlug === activeCourseSlug)
      .sort((left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0));
  }, [activeCourseSlug, activeSchoolSlug, catalog]);

  function sync(nextIds: string[], nextSchoolSlug = activeSchoolSlug) {
    startTransition(() => {
      const trimmed = nextIds.slice(0, 4);
      setSelectedIds(trimmed);
      setActiveSchoolSlug(nextSchoolSlug);

      const params = new URLSearchParams();
      if (trimmed.length) {
        params.set("ids", trimmed.join(","));
      }
      if (nextSchoolSlug) {
        params.set("school", nextSchoolSlug);
      }
      const queryString = params.toString() ? `?${params.toString()}` : "";
      const url = `${pathname}${queryString}`;
      runDeferredNavigation(() => {
        router.replace(url, { scroll: false });
      });
    });
  }

  async function saveCompareSnapshot() {
    if (!supabaseUserId || selectedIds.length === 0) return;
    setSaveBusy(true);
    try {
      const res = await postCompareSet({
        name: saveName.trim() || undefined,
        offeringIds: selectedIds,
        schoolSlug: activeSchoolSlug ?? undefined,
      });
      if (res) {
        setCompareSets((prev) => [res.set, ...prev]);
        setSaveName("");
      }
    } finally {
      setSaveBusy(false);
    }
  }

  function loadSavedCompare() {
    const row = compareSets.find((s) => s.id === loadSetId);
    if (!row || row.offering_ids.length === 0) return;
    sync(row.offering_ids, row.school_slug ?? activeSchoolSlug);
    setLoadSetId("");
  }

  function addItem(hit: SearchHit) {
    if (selectedIds.includes(hit.id) || selectedIds.length >= 4) {
      return;
    }
    setActiveSchoolMeta({
      name: hit.context.schoolShortName,
      coverageTier: hit.coverageTier,
    });
    sync([...selectedIds, hit.id], hit.context.schoolSlug);
  }

  const emptySlots = Math.max(4 - selected.length, 0);

  return (
    <div className="space-y-6">
      <div className="soft-panel rounded-[28px] p-4 lg:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">Compare builder</p>
            <p className="mt-2 truncate text-lg font-semibold text-ink">
              {activeSchool?.schoolName ?? activeSchoolMeta.name ?? "Choose a school"}
            </p>
            <p className="mt-1 text-sm text-muted">
              Start with a school, add up to four options, then compare without losing context.
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={() => {
                startClientMeasure("compare-builder-open", "compare_builder_open_latency", {
                  mobile: isMobile,
                  school_slug: activeSchoolSlug ?? "",
                });
                setBuilderOpen(true);
              }}
              className="inline-flex min-h-11 min-w-[6.75rem] items-center justify-center rounded-full bg-deep-ink px-4 text-sm font-semibold text-ivory"
            >
              Build
            </button>
            <button
              type="button"
              onClick={() => {
                startClientMeasure("compare-catalog-open", "compare_catalog_open_latency", {
                  mobile: isMobile,
                  school_slug: activeSchoolSlug ?? "",
                });
                setCatalogOpen(true);
              }}
              className="inline-flex min-h-11 min-w-[6.75rem] items-center justify-center rounded-full border border-border-strong bg-surface-raised-top px-4 text-sm font-medium text-ink transition-colors hover:border-teal/40 hover:bg-surface-raised-top/90"
            >
              Browse
            </button>
          </div>
        </div>
        {(activeSchool?.coverageTier ?? activeSchoolMeta.coverageTier) ? (
          <div className="mt-3">
            <CoverageBadge
              tier={
                (activeSchool?.coverageTier ??
                  activeSchoolMeta.coverageTier) as CoverageTier
              }
            />
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-full classify-chip-surface px-3 py-1.5">
            {selected.length}/4 filled
          </span>
          <span className="rounded-full classify-chip-surface px-3 py-1.5">
            {activeCourseSlug ? "Course filtered" : "All compare-ready rows"}
          </span>
        </div>
      </div>

      <div className="soft-panel hidden rounded-[30px] p-4 sm:p-5 lg:block">
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr_auto] xl:items-end">
          <div>
            <p className="eyebrow">Compare builder</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Pick a school, then search only that campus. Your comparison list updates as you add rows below.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">School</p>
              <SearchCombobox
                searchType="school"
                limit={10}
                placeholder="Search a school like Texas A&M"
                onSelect={(item) => {
                  setActiveSchoolMeta({
                    name: item.label,
                    coverageTier: item.coverageTier,
                  });
                  setActiveCourseSlug("");
                  sync(selectedIds, item.context.schoolSlug);
                }}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink">Professor or course</p>
              <SearchCombobox
                key={activeSchoolSlug ?? "no-school"}
                searchType="professor"
                schoolSlug={activeSchoolSlug}
                limit={12}
                clearOnSelect
                onSelect={addItem}
                placeholder={
                  activeSchoolSlug
                    ? `Search ${activeSchool?.schoolName ?? activeSchoolMeta.name ?? "this school"}`
                    : "Select a school first"
                }
                emptyMessage={
                  activeSchoolSlug
                    ? "No compare-ready professor-course records match yet for this school."
                    : "Select a school first. Compare search stays scoped to one campus at a time."
                }
                className={!activeSchoolSlug ? "pointer-events-none opacity-55" : undefined}
              />
            </div>
          </div>

          <div className="rounded-[24px] classify-inner p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-deep-ink text-ivory">
                <School className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="eyebrow">Active school</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink">
                  {activeSchool?.schoolName ??
                    activeSchoolMeta.name ??
                    "Choose a school"}
                </p>
              </div>
            </div>
            {activeSchoolSlug ? (
              <button
                type="button"
                onClick={() => {
                  setActiveSchoolMeta({});
                  setActiveCourseSlug("");
                  sync(selectedIds, undefined);
                }}
                className="mt-3 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink"
              >
                Clear school
              </button>
            ) : null}
          </div>
        </div>

        {supabaseUserId ? (
          <div className="mt-6 rounded-[22px] classify-inner p-4 sm:p-5">
            <p className="text-sm font-medium text-ink">Save to your account</p>
            <p className="mt-1 text-xs text-muted">
              Store this comparison to open later from{" "}
              <Link href="/saved" className="font-medium text-ink underline-offset-2 hover:underline">
                Saved
              </Link>
              .
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="block min-w-[10rem] flex-1 text-sm">
                <span className="text-muted">Name (optional)</span>
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Fall picks"
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
                />
              </label>
              <div className="flex min-w-[12rem] flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                <label className="block w-full text-sm">
                  <span className="text-muted">Load saved</span>
                  <select
                    value={loadSetId}
                    onChange={(e) => setLoadSetId(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
                  >
                    <option value="">Choose a saved set...</option>
                    {compareSets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.offering_ids.length})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!loadSetId}
                  onClick={loadSavedCompare}
                  className="h-10 shrink-0 rounded-full border border-border-strong bg-surface-raised-top px-4 text-sm font-medium text-ink disabled:opacity-50"
                >
                  Load
                </button>
              </div>
              <button
                type="button"
                disabled={saveBusy || selectedIds.length === 0}
                onClick={() => void saveCompareSnapshot()}
                className="h-10 rounded-full bg-deep-ink px-5 text-sm font-semibold !text-ivory disabled:opacity-50"
              >
                {saveBusy ? "Saving..." : "Save comparison"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">
            <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
              Sign in with email
            </Link>{" "}
            to save comparisons to your account. Compare URLs still work without an account.
          </p>
        )}
      </div>

      {!selected.length ? (
        <>
          <div className="soft-panel rounded-[28px] p-4 lg:hidden">
            <p className="eyebrow">How compare works</p>
            <div className="mt-3 grid gap-2">
              {[
                "Pick a school to keep the compare set coherent.",
                "Add professor-course rows that teach the class you care about.",
                "Use compare, then add your pick to the planner.",
              ].map((step, index) => (
                <div
                  key={step}
                  className="flex items-start gap-3 rounded-[22px] classify-inner px-4 py-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-deep-ink text-xs font-semibold text-ivory">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-muted">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="soft-panel hidden rounded-[28px] p-6 lg:block">
            <p className="eyebrow">How compare works</p>
            <p className="mt-2 text-sm text-muted">
              Add rows one at a time so each comparison is intentional.
            </p>
            <div className="mt-4 grid gap-2">
              {[
                "Pick a school to keep the compare set coherent.",
                "Add professor-course rows that teach the class you care about.",
                "Use compare, then add your pick to the planner.",
              ].map((step, index) => (
                <div
                  key={`desktop-${step}`}
                  className="flex items-start gap-3 rounded-[22px] classify-inner px-4 py-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-deep-ink text-xs font-semibold text-ivory">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-muted">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {selected.map((item) => {
          const hasInstitutionalRow = offeringHasInstitutionalGradeEvidence(item);
          const showInstitutionalTrend =
            hasInstitutionalRow &&
            (metricHasTrend(item.trend, "aPct") || metricHasTrend(item.trend, "avgGpa"));
          return (
          <article key={item.id} className="soft-panel rounded-[28px] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CoverageBadge tier={item.coverageTier} />
                <h3 className="mt-3 text-lg font-semibold text-ink sm:text-xl">{item.professorName}</h3>
                <p className="text-sm text-muted">
                  {item.courseCode} - {item.courseName}
                </p>
                <p className="mt-1 text-sm text-muted">{item.schoolName}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-border p-2"
                onClick={() => sync(selectedIds.filter((id) => id !== item.id))}
                aria-label={`Remove ${item.professorName}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-2 text-sm sm:mt-5">
              <MetricRow
                label="Classify"
                value={scoreToLabel(item.classifyScore)}
                meta={`score ${formatScore(item.classifyScore)}`}
              />
              {hasInstitutionalRow ? (
                <>
                  <MetricRow label="Expected GPA" value={formatGpa(item.expectedGpa)} />
                  <MetricRow label="A-rate" value={formatPercent(item.aRate)} />
                </>
              ) : (
                <MetricRow
                  label="Institutional GPA / A-rate"
                  value="Not published"
                  meta="Official local aggregates are absent on this row"
                />
              )}
              <MetricRow
                label="RMP"
                value={formatRating(item.rmpRating)}
                meta={`diff ${formatRating(item.rmpDifficulty)}`}
              />
              <MetricRow
                label="Data quality"
                value={confidenceToLabel(item.confidence)}
                meta={`confidence ${item.confidence}`}
              />
            </div>

            <div className="mt-4 rounded-[24px] classify-inner p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">
                Institutional grade trend
              </p>
              {showInstitutionalTrend ? (
                <TrendSparkline trend={item.trend} className="mt-3" />
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Term-by-term GPA/A-rate trends display when this row includes official grade
                  evidence.
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
              <span className="rounded-full border border-border bg-background px-3 py-1.5">
                Freshness {formatFreshnessLabel(item.freshness)}
              </span>
              <span className="rounded-full border border-border bg-background px-3 py-1.5">
                {item.hasSectionPlanning ? "Section timing available" : "Instructor row only"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <PendingLink
                href={`/schools/${item.schoolSlug}/professors/${item.professorSlug}`}
                className="text-sm font-medium text-deep-ink underline-offset-4 hover:underline"
              >
                Open profile
              </PendingLink>
              <PendingLink
                href={`/schools/${item.schoolSlug}/my-courses?courses=${encodeURIComponent(item.courseSlug)}`}
                className="text-sm font-medium text-deep-ink underline-offset-4 hover:underline"
              >
                Plan this course
              </PendingLink>
            </div>
          </article>
          );
        })}

        {Array.from({ length: emptySlots }).map((_, index) => (
          <button
            key={`empty-${index}`}
            type="button"
            onClick={() => (isMobile ? setBuilderOpen(true) : setCatalogOpen(true))}
            className="soft-panel flex min-h-[18rem] flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-border bg-transparent p-5 text-center text-muted transition hover:bg-surface-raised-top/70 sm:min-h-[24rem]"
          >
            <span className="rounded-full classify-chip-surface px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted">
              Slot {selected.length + index + 1}
            </span>
            <div className="flex h-14 w-14 items-center justify-center rounded-full classify-chip-surface text-deep-ink">
              <Plus className="h-5 w-5" />
            </div>
            <p className="mt-4 text-lg font-semibold text-ink">Add a professor</p>
            <p className="mt-2 max-w-[18ch] text-sm">
              Fill this slot from the active school and keep the compare board balanced.
            </p>
          </button>
        ))}
      </div>

      <div className="soft-panel rounded-[28px] p-4 lg:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Catalog</p>
            <p className="mt-1 text-sm text-muted">
              Browse the active school only when you want to add another option.
            </p>
          </div>
            <button
              type="button"
              onClick={() => {
                startClientMeasure("compare-catalog-open", "compare_catalog_open_latency", {
                  mobile: isMobile,
                  school_slug: activeSchoolSlug ?? "",
                });
                setCatalogOpen(true);
              }}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border-strong bg-surface-raised-top px-4 text-sm font-medium text-ink sm:w-auto"
            >
              Browse catalog
          </button>
        </div>
      </div>

      <div className="soft-panel hidden rounded-[30px] p-5 sm:p-6 lg:block">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Catalog</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">
              {activeSchool?.schoolName ??
                activeSchoolMeta.name ??
                "Choose a school to browse the compare catalog"}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {courseOptions.length ? (
              <label className="hidden text-sm text-muted lg:block">
                <span className="sr-only">Filter by course</span>
                <select
                  value={activeCourseSlug}
                  onChange={(event) => setActiveCourseSlug(event.target.value)}
                  className="h-10 min-w-[16rem] rounded-full classify-chip-surface px-4 text-sm text-ink outline-none"
                >
                  <option value="">All courses</option>
                  {courseOptions.map((course) => (
                    <option key={course.courseSlug} value={course.courseSlug}>
                      {course.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {(activeSchool?.coverageTier ?? activeSchoolMeta.coverageTier) ? (
              <CoverageBadge
                tier={
                  (activeSchool?.coverageTier ??
                    activeSchoolMeta.coverageTier) as CoverageTier
                }
              />
            ) : null}
            <button
              type="button"
              onClick={() => setCatalogOpen((value) => !value)}
              aria-expanded={catalogOpen}
              aria-controls="compare-catalog-panel"
              className="inline-flex items-center gap-2 rounded-full classify-chip-surface px-4 py-2 text-sm font-medium text-ink"
            >
              Browse {activeSchool?.schoolName ?? activeSchoolMeta.name ?? "school"} catalog
              <ChevronDown
                className={`h-4 w-4 transition ${catalogOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </div>

        {catalogOpen ? (
          <div id="compare-catalog-panel">
            {activeSchoolSlug ? (
              visibleCatalog.length ? (
                <div className="mt-5 space-y-2">
                  {visibleCatalog.map((item) => {
                    const selectedAlready = selectedIds.includes(item.id);
                    const atLimit = !selectedAlready && selectedIds.length >= 4;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-4 rounded-[24px] classify-inner px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-ink">{item.professorName}</h3>
                            <CoverageBadge tier={item.coverageTier} className="text-[0.62rem]" />
                          </div>
                          <p className="text-sm text-muted">
                            {item.courseCode} - {item.courseName} - {item.department}
                          </p>
                          <p className="mt-2 text-sm text-ink/78">{item.professorSummary}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                          <span className="rounded-full border border-border bg-background px-3 py-1.5">
                            {scoreToLabel(item.classifyScore)}{" "}
                            <span className="text-muted">({formatScore(item.classifyScore)})</span>
                          </span>
                          {offeringHasInstitutionalGradeEvidence(item) ? (
                            <span className="rounded-full border border-border bg-background px-3 py-1.5">
                              GPA {formatGpa(item.expectedGpa)}
                            </span>
                          ) : item.rmpRating != null || item.rmpDifficulty != null ? (
                            <span className="rounded-full border border-border bg-background px-3 py-1.5">
                              RMP {formatRating(item.rmpRating)}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-border bg-background px-3 py-1.5">
                            {item.hasSectionPlanning ? "Section timing" : "No meeting time"}
                          </span>
                          <button
                            type="button"
                            disabled={atLimit}
                            onClick={() =>
                              sync(
                                selectedAlready
                                  ? selectedIds.filter((id) => id !== item.id)
                                  : [...selectedIds, item.id],
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-full bg-deep-ink px-4 py-2 font-medium text-ivory disabled:cursor-not-allowed disabled:bg-deep-ink/40"
                          >
                            {selectedAlready ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            {selectedAlready
                              ? "Remove"
                              : atLimit
                                ? "Limit reached"
                                : "Add"}
                          </button>
                          <PendingLink
                            href={`/schools/${item.schoolSlug}/my-courses?courses=${encodeURIComponent(item.courseSlug)}`}
                            className="items-center rounded-full border border-border px-4 py-2 font-medium text-ink"
                          >
                            Plan
                          </PendingLink>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-[26px] border border-dashed border-border px-4 py-12 text-sm text-muted">
                  This school is searchable, but there are no compare-ready professor-course
                  aggregates published for it yet.
                </div>
              )
            ) : (
              <div className="mt-5 rounded-[26px] border border-dashed border-border px-4 py-12 text-sm text-muted">
                Choose a school above to reveal its compare-ready professor catalog.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {isMobile && builderOpen ? (
        <MobileSheet title="Compare builder" onClose={() => setBuilderOpen(false)}>
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">School</p>
              <SearchCombobox
                searchType="school"
                limit={10}
                placeholder="Search a school like Texas A&M"
                onSelect={(item) => {
                  setActiveSchoolMeta({
                    name: item.label,
                    coverageTier: item.coverageTier,
                  });
                  setActiveCourseSlug("");
                  sync(selectedIds, item.context.schoolSlug);
                }}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink">Professor or course</p>
              <SearchCombobox
                key={`mobile-${activeSchoolSlug ?? "no-school"}`}
                searchType="professor"
                schoolSlug={activeSchoolSlug}
                limit={12}
                clearOnSelect
                onSelect={(item) => {
                  addItem(item);
                  setBuilderOpen(false);
                }}
                placeholder={
                  activeSchoolSlug
                    ? `Search ${activeSchool?.schoolName ?? activeSchoolMeta.name ?? "this school"}`
                    : "Select a school first"
                }
                emptyMessage={
                  activeSchoolSlug
                    ? "No compare-ready professor-course records match yet for this school."
                    : "Select a school first. Compare search stays scoped to one campus at a time."
                }
                className={!activeSchoolSlug ? "pointer-events-none opacity-55" : undefined}
              />
            </div>

            <div className="rounded-[24px] classify-inner p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-deep-ink text-ivory">
                  <School className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="eyebrow">Active school</p>
                  <p className="mt-1 truncate text-sm font-semibold text-ink">
                    {activeSchool?.schoolName ?? activeSchoolMeta.name ?? "Choose a school"}
                  </p>
                </div>
              </div>
              {activeSchoolSlug ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSchoolMeta({});
                    setActiveCourseSlug("");
                    sync(selectedIds, undefined);
                  }}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-ink sm:w-auto"
                >
                  Clear school
                </button>
              ) : null}
            </div>

            {supabaseUserId ? (
              <div className="rounded-[22px] classify-inner p-4">
                <p className="text-sm font-medium text-ink">Save to your account</p>
                <div className="mt-3 space-y-3">
                  <label className="block text-sm">
                    <span className="text-muted">Name (optional)</span>
                    <input
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder="e.g. Fall picks"
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted">Load saved</span>
                    <select
                      value={loadSetId}
                      onChange={(e) => setLoadSetId(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
                    >
                      <option value="">Choose a saved set...</option>
                      {compareSets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.offering_ids.length})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!loadSetId}
                      onClick={() => {
                        loadSavedCompare();
                        setBuilderOpen(false);
                      }}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong bg-surface-raised-top px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      disabled={saveBusy || selectedIds.length === 0}
                      onClick={() => void saveCompareSnapshot()}
                      className="inline-flex min-h-11 items-center justify-center rounded-full bg-deep-ink px-4 py-2 text-sm font-semibold text-ivory disabled:opacity-50"
                    >
                      {saveBusy ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">
                <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
                  Sign in with email
                </Link>{" "}
                to save comparisons to your account.
              </p>
            )}
          </div>
        </MobileSheet>
      ) : null}

      {isMobile && catalogOpen ? (
        <MobileSheet
          title={`${activeSchool?.schoolName ?? activeSchoolMeta.name ?? "School"} catalog`}
          onClose={() => setCatalogOpen(false)}
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {courseOptions.length ? (
                <label className="block w-full text-sm text-muted">
                  <span className="sr-only">Filter by course</span>
                  <select
                    value={activeCourseSlug}
                    onChange={(event) => setActiveCourseSlug(event.target.value)}
                    className="h-11 w-full rounded-full classify-chip-surface px-4 text-base text-ink outline-none"
                  >
                    <option value="">All courses</option>
                    {courseOptions.map((course) => (
                      <option key={course.courseSlug} value={course.courseSlug}>
                        {course.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {(activeSchool?.coverageTier ?? activeSchoolMeta.coverageTier) ? (
                <CoverageBadge
                  tier={
                    (activeSchool?.coverageTier ??
                      activeSchoolMeta.coverageTier) as CoverageTier
                  }
                />
              ) : null}
            </div>
            {activeSchoolSlug ? (
              visibleCatalog.length ? (
                <div className="mt-5 space-y-2">
                  {visibleCatalog.map((item) => {
                    const selectedAlready = selectedIds.includes(item.id);
                    const atLimit = !selectedAlready && selectedIds.length >= 4;

                    return (
                      <div
                        key={item.id}
                        className="rounded-[24px] classify-inner px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-ink">{item.professorName}</h3>
                          <CoverageBadge tier={item.coverageTier} className="text-[0.62rem]" />
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {item.courseCode} - {item.courseName} - {item.department}
                        </p>
                        <p className="mt-2 text-sm text-ink/78">{item.professorSummary}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
                          <span className="rounded-full border border-border bg-background px-3 py-1.5">
                            {scoreToLabel(item.classifyScore)}{" "}
                            <span className="text-muted">({formatScore(item.classifyScore)})</span>
                          </span>
                          {offeringHasInstitutionalGradeEvidence(item) ? (
                            <span className="rounded-full border border-border bg-background px-3 py-1.5">
                              GPA {formatGpa(item.expectedGpa)}
                            </span>
                          ) : item.rmpRating != null || item.rmpDifficulty != null ? (
                            <span className="rounded-full border border-border bg-background px-3 py-1.5">
                              RMP {formatRating(item.rmpRating)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                          <button
                            type="button"
                            disabled={atLimit}
                            onClick={() => {
                              sync(
                                selectedAlready
                                  ? selectedIds.filter((id) => id !== item.id)
                                  : [...selectedIds, item.id],
                              );
                              if (!selectedAlready) {
                                setCatalogOpen(false);
                              }
                            }}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-deep-ink px-4 py-2 text-sm font-medium text-ivory disabled:cursor-not-allowed disabled:bg-deep-ink/40"
                          >
                            {selectedAlready ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            {selectedAlready
                              ? "Remove"
                              : atLimit
                                ? "Limit reached"
                                : "Add"}
                          </button>
                          <PendingLink
                            href={`/schools/${item.schoolSlug}/my-courses?courses=${encodeURIComponent(item.courseSlug)}`}
                            className="min-h-11 items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-ink"
                          >
                            Plan
                          </PendingLink>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-[26px] border border-dashed border-border px-4 py-12 text-sm text-muted">
                  This school is searchable, but there are no compare-ready professor-course
                  aggregates published for it yet.
                </div>
              )
            ) : (
              <div className="mt-5 rounded-[26px] border border-dashed border-border px-4 py-12 text-sm text-muted">
                Choose a school above to reveal its compare-ready professor catalog.
              </div>
            )}
          </div>
        </MobileSheet>
      ) : null}
    </div>
  );
}

function MetricRow({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="rounded-2xl classify-inner-soft px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">{label}</span>
        <strong className="text-ink">{value}</strong>
      </div>
      {meta ? <p className="mt-1 text-xs text-muted">{meta}</p> : null}
    </div>
  );
}
