"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Plus, School, X } from "lucide-react";
import { CoverageBadge } from "@/components/coverage-badge";
import { TrendSparkline } from "@/components/charts/trend-sparkline";
import { SearchCombobox } from "@/components/search/search-combobox";
import {
  type CoverageTier,
  type ProfessorCourseSummary,
  type SearchHit,
} from "@/lib/types";
import {
  confidenceToLabel,
  formatGpa,
  formatPercent,
  formatRating,
  formatScore,
  scoreToLabel,
} from "@/lib/utils";

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
  const [, startTransition] = useTransition();

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

  const visibleCatalog = useMemo(() => {
    return [...catalog]
      .filter((item) => !activeSchoolSlug || item.schoolSlug === activeSchoolSlug)
      .sort((left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0));
  }, [activeSchoolSlug, catalog]);

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
      router.replace(`${pathname}${queryString}`, { scroll: false });
    });
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
      <div className="soft-panel sticky top-24 z-30 rounded-[30px] p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr_auto] xl:items-end">
          <div>
            <p className="eyebrow">Compare builder</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Pick a school, then search only that campus. The comparison stays front and center.
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

          <div className="rounded-[24px] border border-border/70 bg-white/72 p-4">
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
                  sync(selectedIds, undefined);
                }}
                className="mt-3 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink"
              >
                Clear school
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {selected.map((item) => (
          <article key={item.id} className="soft-panel rounded-[28px] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CoverageBadge tier={item.coverageTier} />
                <h3 className="mt-3 text-xl font-semibold text-ink">{item.professorName}</h3>
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

            <div className="mt-5 space-y-3 text-sm">
              <MetricRow
                label="Classify"
                value={scoreToLabel(item.classifyScore)}
                meta={`score ${formatScore(item.classifyScore)}`}
              />
              <MetricRow label="Expected GPA" value={formatGpa(item.expectedGpa)} />
              <MetricRow label="A-rate" value={formatPercent(item.aRate)} />
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

            <div className="mt-5 rounded-[24px] border border-border/80 bg-white/65 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Trend</p>
              <TrendSparkline trend={item.trend} className="mt-3" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
              <span className="rounded-full border border-border bg-background px-3 py-1.5">
                Freshness {item.freshness}
              </span>
            </div>

            <Link
              href={`/schools/${item.schoolSlug}/professors/${item.professorSlug}`}
              className="mt-4 inline-flex text-sm font-medium text-deep-ink underline-offset-4 hover:underline"
            >
              Open profile
            </Link>
          </article>
        ))}

        {Array.from({ length: emptySlots }).map((_, index) => (
          <button
            key={`empty-${index}`}
            type="button"
            onClick={() => setCatalogOpen(true)}
            className="soft-panel flex min-h-[24rem] flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-border bg-transparent p-5 text-center text-muted transition hover:bg-white/55"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-white/72 text-deep-ink">
              <Plus className="h-5 w-5" />
            </div>
            <p className="mt-4 text-lg font-semibold text-ink">Add a professor</p>
            <p className="mt-2 max-w-[18ch] text-sm">
              Browse the active school catalog to fill the remaining compare slots.
            </p>
          </button>
        ))}
      </div>

      <div className="soft-panel rounded-[30px] p-5 sm:p-6">
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
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white/72 px-4 py-2 text-sm font-medium text-ink"
            >
              Browse {activeSchool?.schoolName ?? activeSchoolMeta.name ?? "school"} catalog
              <ChevronDown
                className={`h-4 w-4 transition ${catalogOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </div>

        {catalogOpen ? (
          activeSchoolSlug ? (
            visibleCatalog.length ? (
              <div className="mt-5 space-y-2">
                {visibleCatalog.map((item) => {
                  const selectedAlready = selectedIds.includes(item.id);
                  const atLimit = !selectedAlready && selectedIds.length >= 4;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 rounded-[24px] border border-border/70 bg-white/72 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
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
                        <span className="rounded-full border border-border bg-background px-3 py-1.5">
                          GPA {formatGpa(item.expectedGpa)}
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
          )
        ) : null}
      </div>
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
    <div className="rounded-2xl bg-white/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">{label}</span>
        <strong className="text-ink">{value}</strong>
      </div>
      {meta ? <p className="mt-1 text-xs text-muted">{meta}</p> : null}
    </div>
  );
}
