import Link from "next/link";
import { Search } from "lucide-react";
import { CoverageBadge } from "@/components/coverage-badge";
import { SearchCombobox } from "@/components/search/search-combobox";
import { SiteHeader } from "@/components/site-header";
import { getFeaturedOfferings } from "@/lib/catalog";
import { searchDirectory } from "@/lib/server-directory";
import { type SearchHit } from "@/lib/types";
import { formatScore, scoreToLabel } from "@/lib/utils";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const results = query ? await searchDirectory(query, { limit: 30 }) : [];
  const featured = getFeaturedOfferings();
  const grouped = {
    school: results.filter((item) => item.type === "school"),
    course: results.filter((item) => item.type === "course"),
    professor: results.filter((item) => item.type === "professor"),
  };

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <p className="eyebrow">Universal search</p>
          <h1 className="app-page-title mt-3 font-semibold text-ink">
            Search schools, courses, and professors in one place
          </h1>
          <p className="app-lead mt-4">
            Schools stay pinned to the top until context is clear. Once you enter
            a course or professor, Classify pivots to the course-level data that
            RMP cannot organize.
          </p>
          <div className="mt-8">
            <SearchCombobox initialQuery={query} />
          </div>
        </section>

        {query ? (
          <section className="mt-8 space-y-8">
            {grouped.school.length ? (
              <div className="soft-panel rounded-[30px] p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-deep-ink text-ivory">
                    <Search className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="eyebrow">school</p>
                    <h2 className="text-2xl font-semibold capitalize text-ink">
                      School results
                    </h2>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  {grouped.school.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex flex-col gap-3 rounded-[24px] border border-border/70 bg-white/72 px-4 py-4 transition hover:bg-white"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-ink">{item.label}</h3>
                          <p className="text-sm text-muted">{item.school}</p>
                        </div>
                        <CoverageBadge tier={item.coverageTier} className="text-[0.62rem]" />
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted">
                        {item.secondaryMetrics.map((metric) => (
                          <MetricPill key={metric} metric={metric} />
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {(["course", "professor"] as const).map((key) =>
              grouped[key].length ? (
                <div key={key} className="soft-panel rounded-[30px] p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-deep-ink text-ivory">
                      <Search className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="eyebrow">{key}</p>
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
                            <Link
                              key={item.id}
                              href={item.href}
                              className="flex flex-col gap-2 rounded-[24px] border border-border/70 bg-white/72 px-4 py-3 transition hover:bg-white"
                            >
                              <h3 className="text-lg font-semibold text-ink">{item.label}</h3>
                              <div className="flex flex-wrap gap-2 text-xs text-muted">
                                {item.secondaryMetrics.map((metric) => (
                                  <MetricPill key={metric} metric={metric} />
                                ))}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </section>
        ) : (
          <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="soft-panel rounded-[30px] p-5 sm:p-6">
              <p className="eyebrow">Search cues</p>
              <h2 className="mt-3 text-3xl font-semibold text-ink">
                What to search first
              </h2>
              <div className="mt-6 space-y-3 text-sm text-muted">
                <div className="rounded-[24px] border border-border/70 bg-white/72 px-4 py-4">
                  Try a school name first if you want the full school hub and coverage
                  status.
                </div>
                <div className="rounded-[24px] border border-border/70 bg-white/72 px-4 py-4">
                  Try a course code like <code>CS 312</code> if your question is
                  &nbsp;&quot;who teaches this class and gives the most A&apos;s?&quot;
                </div>
                <div className="rounded-[24px] border border-border/70 bg-white/72 px-4 py-4">
                  Try a professor name if you already know the person and want the
                  profile page.
                </div>
              </div>
            </div>
            <div className="soft-panel rounded-[30px] p-5 sm:p-6">
              <p className="eyebrow">Featured course options</p>
              <div className="mt-5 space-y-3">
                {featured.slice(0, 4).map((item) => (
                  <Link
                    key={item.id}
                    href={`/schools/${item.schoolSlug}/professors/${item.professorSlug}`}
                    className="block rounded-[24px] border border-border/70 bg-white/72 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-ink">{item.professorName}</p>
                        <p className="text-sm text-muted">
                          {item.courseCode} - {item.courseName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-ink">
                          {scoreToLabel(item.classifyScore)}
                        </p>
                        <p className="text-xs text-muted">
                          score {formatScore(item.classifyScore)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function groupBySchool(items: SearchHit[]) {
  const groups = new Map<string, SearchHit[]>();

  for (const item of items) {
    groups.set(item.school, [...(groups.get(item.school) ?? []), item]);
  }

  return [...groups.entries()];
}

function MetricPill({ metric }: { metric: string }) {
  const match = metric.match(/(?:Top )?Classify\s+(\d+)/i);

  if (match) {
    const score = Number(match[1]);
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
