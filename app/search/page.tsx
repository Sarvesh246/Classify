import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { CoverageBadge } from "@/components/coverage-badge";
import { SearchHitLink } from "@/components/search/search-hit-link";
import { SearchEntrySurfaceIsland } from "@/components/search/search-entry-surface-island";
import { SiteHeader } from "@/components/site-header";
import { getDirectorySchoolBySlug, searchDirectoryWithTotal } from "@/lib/server-directory";
import { type SearchHit, type SearchHitType } from "@/lib/types";
import { formatScore, scoreToLabel } from "@/lib/utils";

const PAGE_SIZE = 24;

type SearchPageProps = {
  searchParams: Promise<{ q?: string; school?: string; type?: string; page?: string; source?: string }>;
};

function parseFilterType(raw: string | undefined): SearchHitType | "all" {
  if (raw === "school" || raw === "course" || raw === "professor") return raw;
  return "all";
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  await connection();
  const params = await searchParams;
  // Legacy web-app shortcuts may still launch with `/search?source=pwa`.
  // Home is the intended standalone entry surface.
  if (params.source === "pwa" && !params.q && !params.school && !params.type && !params.page) {
    redirect("/");
  }
  const query = params.q?.trim() ?? "";
  const schoolParam = params.school?.trim() || undefined;
  const filterType = parseFilterType(params.type?.trim());
  const school = schoolParam ? await getDirectorySchoolBySlug(schoolParam) : undefined;
  const schoolShortName = school?.shortName;

  const shouldSearch =
    query.length > 0 || Boolean(schoolParam) || filterType !== "all";
  const pageRequested = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  let searchTotal = 0;
  let results: SearchHit[] = [];
  let safePage = 1;
  let totalPages = 1;
  let pageSizeUsed = PAGE_SIZE;

  if (shouldSearch) {
    const browseWithoutQuery = query.length === 0;
    const pageSize = browseWithoutQuery ? PAGE_SIZE : 30;
    pageSizeUsed = pageSize;
    let page = pageRequested;
    let offset = (page - 1) * pageSize;

    let batch = await searchDirectoryWithTotal(query, {
      limit: pageSize,
      offset,
      schoolSlug: schoolParam,
      type: filterType,
    });
    searchTotal = batch.total;
    totalPages = Math.max(1, Math.ceil(searchTotal / pageSize));
    if (page > totalPages && totalPages > 0) {
      page = totalPages;
      offset = (page - 1) * pageSize;
      batch = await searchDirectoryWithTotal(query, {
        limit: pageSize,
        offset,
        schoolSlug: schoolParam,
        type: filterType,
      });
    }
    safePage = page;
    results = batch.results;
  }

  const grouped = {
    school: results.filter((item) => item.type === "school"),
    course: results.filter((item) => item.type === "course"),
    professor: results.filter((item) => item.type === "professor"),
  };

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-4 pb-16 md:pt-10 md:pb-10">
        <SearchEntrySurfaceIsland
          query={query}
          schoolSlug={schoolParam}
          filterType={filterType}
          schoolShortName={schoolShortName}
        />

        {shouldSearch ? (
          <section className="mt-8 space-y-8">
            {!results.length ? (
              <div className="soft-panel rounded-[30px] p-8 text-ink">
                <p className="text-center text-lg font-semibold">No matches for this search</p>
                <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted">
                  Try a shorter query, a course code with or without a space (
                  <code className="rounded bg-background px-1">CSCE 221</code> or{" "}
                  <code className="rounded bg-background px-1">CSCE221</code>
                  ), or widen the scope.
                </p>
                <ul className="mx-auto mt-6 max-w-md list-disc space-y-2 pl-5 text-sm text-muted">
                  <li>
                    <Link href="/search" className="text-ink underline underline-offset-2">
                      Clear filters and open full search
                    </Link>
                  </li>
                  <li>
                    <Link href="/methodology" className="text-ink underline underline-offset-2">
                      Read how we score and source data
                    </Link>
                  </li>
                  <li>
                    Browse a school hub from the homepage, then use{" "}
                    <strong className="text-ink">Search within this school</strong>.
                  </li>
                </ul>
              </div>
            ) : null}

            {grouped.school.length ? (
              <div className="soft-panel rounded-[28px] p-4 sm:rounded-[30px] sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-deep-ink text-ivory">
                    <Search className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="eyebrow">School</p>
                    <h2 className="text-2xl font-semibold capitalize text-ink">
                      School results
                    </h2>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  {grouped.school.map((item) => (
                    <SearchHitLink
                      key={item.id}
                      href={item.href}
                      className="classify-inner classify-inner--hover flex flex-col gap-3 rounded-[22px] px-4 py-3 transition sm:rounded-[24px] sm:py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-ink sm:text-lg">{item.label}</h3>
                          <p className="text-xs text-muted sm:text-sm">{item.school}</p>
                        </div>
                        <CoverageBadge tier={item.coverageTier} className="text-[0.62rem]" />
                      </div>
                      {item.rankHints?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {item.rankHints.map((hint) => (
                            <RankHintPill key={hint} text={hint} />
                          ))}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2 text-xs text-muted">
                        {item.secondaryMetrics.map((metric) => (
                          <MetricPill key={metric} metric={metric} />
                        ))}
                      </div>
                    </SearchHitLink>
                  ))}
                </div>
              </div>
            ) : null}

            {(["course", "professor"] as const).map((key) =>
              grouped[key].length ? (
                <div key={key} className="soft-panel rounded-[28px] p-4 sm:rounded-[30px] sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-deep-ink text-ivory">
                      <Search className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="eyebrow capitalize">{key}</p>
                      <h2 className="text-2xl font-semibold capitalize text-ink">
                        {key} results
                      </h2>
                    </div>
                  </div>
                  <div className="mt-5 space-y-5">
                    {groupBySchool(grouped[key]).map(([schoolName, items]) => (
                      <div key={`${key}-${schoolName}`}>
                        <div className="mb-3 flex items-center gap-3">
                          <p className="text-sm font-semibold text-ink">{schoolName}</p>
                          <CoverageBadge
                            tier={items[0].coverageTier}
                            className="text-[0.62rem]"
                          />
                        </div>
                        <div className="space-y-2">
                          {items.map((item) => (
                            <SearchHitLink
                              key={item.id}
                              href={item.href}
                              className="classify-inner classify-inner--hover flex flex-col gap-2 rounded-[22px] px-4 py-3 transition sm:rounded-[24px]"
                            >
                              <h3 className="text-base font-semibold text-ink sm:text-lg">{item.label}</h3>
                              {item.rankHints?.length ? (
                                <div className="flex flex-wrap gap-2">
                                  {item.rankHints.map((hint) => (
                                    <RankHintPill key={hint} text={hint} />
                                  ))}
                                </div>
                              ) : null}
                              <div className="flex flex-wrap gap-2 text-xs text-muted">
                                {item.secondaryMetrics.map((metric) => (
                                  <MetricPill key={metric} metric={metric} />
                                ))}
                              </div>
                            </SearchHitLink>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null,
            )}

            {shouldSearch && totalPages > 1 ? (
              <nav
                className="mt-8 flex flex-wrap items-center justify-center gap-3"
                aria-label="Search results pagination"
              >
                {safePage > 1 ? (
                  <Link
                    href={searchResultsHref({
                      q: query,
                      school: schoolParam,
                      type: filterType,
                      page: safePage - 1,
                    })}
                    className="inline-flex min-h-11 items-center justify-center rounded-full classify-chip-surface px-4 text-sm font-medium text-ink hover:bg-surface-raised-top/90"
                  >
                    Previous
                  </Link>
                ) : null}
                <span className="text-sm text-muted">
                  Page {safePage} of {totalPages}
                  {searchTotal > 0 ? (
                    <>
                      {" "}
                      | {(safePage - 1) * pageSizeUsed + 1}-
                      {(safePage - 1) * pageSizeUsed + results.length} of {searchTotal}
                    </>
                  ) : null}
                </span>
                {safePage < totalPages ? (
                  <Link
                    href={searchResultsHref({
                      q: query,
                      school: schoolParam,
                      type: filterType,
                      page: safePage + 1,
                    })}
                    className="inline-flex min-h-11 items-center justify-center rounded-full classify-chip-surface px-4 text-sm font-medium text-ink hover:bg-surface-raised-top/90"
                  >
                    Next
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function searchResultsHref(args: {
  q: string;
  school?: string;
  type: SearchHitType | "all";
  page: number;
}) {
  const p = new URLSearchParams();
  if (args.q.trim()) p.set("q", args.q.trim());
  if (args.school?.trim()) p.set("school", args.school.trim());
  if (args.type !== "all") p.set("type", args.type);
  if (args.page > 1) p.set("page", String(args.page));
  const qs = p.toString();
  return qs ? `/search?${qs}` : "/search";
}

function groupBySchool(items: SearchHit[]) {
  const groups = new Map<string, SearchHit[]>();

  for (const item of items) {
    groups.set(item.school, [...(groups.get(item.school) ?? []), item]);
  }

  return [...groups.entries()];
}

function RankHintPill({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-border/70 bg-deep-ink/[0.06] px-3 py-1 text-xs text-muted">
      {text}
    </span>
  );
}

function MetricPill({ metric }: { metric: string }) {
  const match = metric.match(/(?:Top )?Classify\s+(\d+)/i);

  if (match) {
    const score = Number(match[1]);
    if (!Number.isFinite(score)) {
      return (
        <span className="rounded-full border border-border bg-background px-3 py-1.5">
          {metric}
        </span>
      );
    }
    return (
      <span className="rounded-full border border-border bg-background px-3 py-1.5">
        {scoreToLabel(score)} <span className="text-muted">({formatScore(score)})</span>
      </span>
    );
  }

  return (
    <span className="rounded-full border border-border bg-background px-3 py-1.5">
      {metric}
    </span>
  );
}
