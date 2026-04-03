"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { ArrowRight, LineChart, Search, SlidersHorizontal } from "lucide-react";
import { SearchCombobox } from "@/components/search/search-combobox";
import { CoverageBadge } from "@/components/coverage-badge";
import { TrendSparkline } from "@/components/charts/trend-sparkline";
import {
  getCoverageStats,
  getFeaturedOfferings,
  getSchoolSpotlight,
  getSchools,
} from "@/lib/data";
import { formatGpa, formatPercent, formatScore, scoreToLabel } from "@/lib/utils";

const HomeScene = dynamic(
  () => import("@/components/home/home-scene").then((mod) => mod.HomeScene),
  { ssr: false },
);

export function HomeExperience() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState("ut-austin");

  useMotionValueEvent(scrollYProgress, "change", (latest) => setProgress(latest));

  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const coverage = getCoverageStats();
  const featured = getFeaturedOfferings();
  const spotlight = getSchoolSpotlight(selectedSchool);
  const schools = getSchools().slice(0, 6);
  const useCanvas = !reduceMotion && !isMobile;

  const narrative = useMemo(
    () => [
      {
        title: "Outcome-driven",
        body: "Classify anchors every ranking in expected GPA and A-rate first, then layers RMP as enrichment instead of pretending opinion is evidence.",
      },
      {
        title: "Course-specific",
        body: "You can search the exact class you need and immediately see which instructor is most likely to preserve your GPA.",
      },
      {
        title: "Trend-aware",
        body: "If a professor or course has gotten harder over time, the product shows the slope instead of burying old reviews next to new realities.",
      },
    ],
    [],
  );

  return (
    <div className="relative overflow-x-hidden bg-deep-ink text-ivory">
      <div className="fixed inset-0">
        {useCanvas ? (
          <HomeScene progress={progress} />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,199,184,0.18),transparent_28%),radial-gradient(circle_at_70%_30%,rgba(201,138,87,0.12),transparent_24%),linear-gradient(180deg,#07111F_0%,#0A1C31_50%,#08111F_100%)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,17,31,0.42),rgba(7,17,31,0.82)_36%,rgba(7,17,31,0.95)_100%)]" />
      </div>

      <div className="relative z-10">
        <section className="section-shell flex min-h-[calc(100svh-4.5rem)] flex-col justify-center py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto w-full max-w-5xl"
          >
            <div className="mx-auto max-w-4xl">
              <SearchCombobox placeholder="Search a school, course code, or professor" />
            </div>

            <div className="mx-auto mt-6 max-w-3xl text-center">
              <h1 className="display-title text-4xl font-semibold leading-[0.94] tracking-[-0.07em] text-balance sm:text-6xl">
                Find the professor who actually gives A&apos;s.
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-ivory/76 sm:text-lg">
                Grade distributions, not just opinions — for {coverage.trackedSchools} schools across the US.
              </p>
            </div>

            <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-3 text-sm text-ivory/82">
              <InlineStat label="Tracked schools" value={coverage.trackedSchools} />
              <InlineStat label="Institutional schools" value={coverage.institutionalSchools} />
              <InlineStat label="Tracked course options" value={coverage.trackedCourses} />
            </div>
          </motion.div>
        </section>

        <section className="section-shell py-20 sm:py-28">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="soft-panel rounded-[34px] p-6 text-ink sm:p-8">
              <p className="eyebrow">Why it beats RMP</p>
              <div className="mt-6 space-y-6">
                {narrative.map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ delay: index * 0.08, duration: 0.5 }}
                  >
                    <h2 className="display-title text-3xl font-semibold">{item.title}</h2>
                    <p className="mt-2 text-base leading-7 text-muted">{item.body}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="glass-line rounded-[34px] p-6">
              <p className="eyebrow text-ivory/88">Featured picks</p>
              <div className="mt-5 space-y-3">
                {featured.slice(0, 4).map((item) => (
                  <Link
                    key={item.id}
                    href={`/schools/${item.schoolSlug}/professors/${item.professorSlug}`}
                    className="block rounded-[24px] border border-white/10 bg-white/6 p-4 transition hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold">{item.professorName}</p>
                        <p className="text-sm text-ivory/68">
                          {item.courseCode} - {item.courseName}
                        </p>
                      </div>
                      <CoverageBadge tier={item.coverageTier} variant="onDark" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-ivory/88">
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        {scoreToLabel(item.classifyScore)}{" "}
                        <span className="text-ivory/58">(score {formatScore(item.classifyScore)})</span>
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        GPA {formatGpa(item.expectedGpa)}
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        A-rate {formatPercent(item.aRate)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section-shell py-20 sm:py-28">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="soft-panel rounded-[34px] p-6 text-ink sm:p-8">
              <p className="eyebrow">Coverage atlas</p>
              <h2 className="display-title mt-4 text-4xl font-semibold">
                One search bar, multiple data tiers
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted">
                Schools with institutional outcomes unlock trend-aware course intelligence.
                Every other school still stays searchable through RMP fallback, with clear
                labeling instead of fake precision.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {schools.map((school) => (
                  <button
                    key={school.slug}
                    type="button"
                    onClick={() => setSelectedSchool(school.slug)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      selectedSchool === school.slug
                        ? "border-deep-ink bg-deep-ink text-ivory"
                        : "border-border bg-white/70 text-ink hover:bg-white"
                    }`}
                  >
                    {school.shortName}
                  </button>
                ))}
              </div>
            </div>

            {spotlight ? (
              <div className="glass-line rounded-[34px] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow text-ivory/88">Selected school</p>
                    <h3 className="display-title mt-2 text-4xl font-semibold">
                      {spotlight.school.shortName}
                    </h3>
                    <p className="mt-2 text-sm text-ivory/68">
                      {spotlight.school.city}, {spotlight.school.state} - {spotlight.school.kind}
                    </p>
                  </div>
                  <CoverageBadge tier={spotlight.school.coverageTier} variant="onDark" />
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-ivory/76">
                  {spotlight.school.sourceStatus.note}
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {spotlight.courses.length ? (
                    spotlight.courses.slice(0, 2).map((course) => (
                      <div
                        key={course.courseSlug}
                        className="rounded-[26px] border border-white/10 bg-white/6 p-4"
                      >
                        <p className="text-lg font-semibold">
                          {course.courseCode} - {course.courseName}
                        </p>
                        <p className="mt-1 text-sm text-ivory/66">{course.summary}</p>
                        <p className="mt-3 text-sm text-ivory/76">
                          Top pick: {course.topProfessorName}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[26px] border border-dashed border-white/15 px-4 py-10 text-sm text-ivory/70">
                      RMP-only mode for now. Course-level grade distributions arrive when the
                      institutional adapter is ready.
                    </div>
                  )}
                  {spotlight.trending[0] ? (
                    <div className="rounded-[26px] border border-white/10 bg-white/6 p-4">
                      <p className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-ivory/64">
                        <LineChart className="h-4 w-4" />
                        Trend callout
                      </p>
                      <p className="mt-3 text-lg font-semibold">
                        {spotlight.trending[0].professorName}
                      </p>
                      <p className="mt-1 text-sm text-ivory/68">
                        {spotlight.trending[0].courseCode} is trending{" "}
                        {(spotlight.trending[0].trendDelta ?? 0) >= 0 ? "easier" : "harder"}.
                      </p>
                      <TrendSparkline trend={spotlight.trending[0].trend} className="mt-4" />
                    </div>
                  ) : (
                    <div className="rounded-[26px] border border-dashed border-white/15 px-4 py-10 text-sm text-ivory/70">
                      Trend cards appear automatically once institutional history exists.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="section-shell py-20 sm:py-28">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="soft-panel rounded-[34px] p-6 text-ink sm:p-8">
              <div className="flex items-center gap-3 text-sm uppercase tracking-[0.18em] text-muted">
                <SlidersHorizontal className="h-4 w-4" />
                Comparison mode
              </div>
              <h2 className="display-title mt-4 text-4xl font-semibold">
                Compare instructor options before you build your schedule
              </h2>
              <p className="mt-4 text-base leading-7 text-muted">
                Evaluate expected GPA, A-rate, rating, difficulty, and trend in a single,
                clean workspace. It is the missing step between &quot;I heard they
                are good&quot; and &quot;I know which section protects my
                semester.&quot;
              </p>
              <div className="mt-8 space-y-3">
                {featured.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-border/70 bg-white/72 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{item.professorName}</p>
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
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-line rounded-[34px] p-6">
              <p className="eyebrow text-ivory/88">What follows next</p>
              <h2 className="display-title mt-4 text-4xl font-semibold">
                The product is built around a better data shape
              </h2>
              <p className="mt-4 text-base leading-7 text-ivory/74">
                Raw snapshots, normalized grade distributions, published aggregates, RMP
                enrichment, and confidence-aware professor matching all feed the same app
                model. That is what makes optimizer-mode feasible later without rewriting the
                product.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 rounded-full bg-ivory px-5 py-3 text-sm font-medium text-deep-ink"
                >
                  <Search className="h-4 w-4" />
                  Open the search app
                </Link>
                <Link
                  href="/compare"
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 px-5 py-3 text-sm font-medium text-ivory"
                >
                  Compare live records
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2">
      <span className="font-semibold text-ivory">{value}</span>{" "}
      <span className="text-ivory/68">{label}</span>
    </div>
  );
}
