"use client";

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
import { MobileHomeLaunchpad } from "@/components/home/mobile-home-launchpad";
import { CoverageBadge } from "@/components/coverage-badge";
import { HomeScene } from "@/components/home/home-scene";
import { TrendSparkline } from "@/components/charts/trend-sparkline";
import { useAppRuntime } from "@/hooks/use-app-runtime";
import type { CourseGroup, ProfessorCourseSummary, School } from "@/lib/types";
import { formatGpa, formatPercent, formatScore, scoreToLabel } from "@/lib/utils";

type HomeExperienceProps = {
  coverage: {
    searchableSchools: number;
    trackedSchools: number;
    institutionalSchools: number;
    plannerReadySchools: number;
    catalogReadySchools?: number;
    scheduleReadySchools?: number;
    evidenceReadySchools?: number;
    trackedCourses: number;
    trackedProfessors: number;
  };
  featured: ProfessorCourseSummary[];
  spotlights: Array<{
    school: School;
    courses: CourseGroup[];
    trending: ProfessorCourseSummary[];
  }>;
};

export function HomeExperience({
  coverage,
  featured,
  spotlights,
}: HomeExperienceProps) {
  const reduceMotion = useReducedMotion();
  const { isStandalone } = useAppRuntime();
  const { scrollYProgress } = useScroll();
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(spotlights[0]?.school.slug ?? "");

  useMotionValueEvent(scrollYProgress, "change", (latest) => setProgress(latest));

  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const useCanvas = !reduceMotion && !isMobile && !isStandalone;
  const spotlight = useMemo(
    () => spotlights.find((item) => item.school.slug === selectedSchool) ?? spotlights[0],
    [selectedSchool, spotlights],
  );

  const narrative = useMemo(
    () => [
      {
        title: "Outcome-driven",
        body: "Classify anchors every ranking in expected GPA and A-rate first, then layers outside review signals as enrichment instead of pretending opinion is evidence.",
      },
      {
        title: "Course-specific",
        body: "You can search the exact class you need and immediately see which instructor is most likely to protect your semester.",
      },
      {
        title: "Planner-ready",
        body: "Every searchable school lands in the same planning surface first. Catalog, schedule, and evidence depth expand without changing the workflow.",
      },
    ],
    [],
  );

  function cleanCourseSummary(course: CourseGroup) {
    const summary = course.summary.trim();
    return summary
      .replace(`${course.courseCode} ${course.courseCode}`, course.courseCode)
      .replace(`${course.courseName} ${course.courseName}`, course.courseName);
  }

  return (
    <div className="relative overflow-x-hidden bg-deep-ink text-ivory">
      <div className="fixed inset-0">
        {useCanvas ? (
          <HomeScene progress={progress} />
        ) : (
          <div className="absolute inset-0 overflow-hidden">
            <div className="mobile-ambient-backdrop absolute inset-0" />
            <div className="mobile-ambient-orb mobile-ambient-orb-a" />
            <div className="mobile-ambient-orb mobile-ambient-orb-b" />
            <div className="mobile-ambient-grid absolute inset-0 opacity-40" />
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,17,31,0.42),rgba(7,17,31,0.82)_36%,rgba(7,17,31,0.95)_100%)]" />
      </div>

      <div className="relative z-10">
        <section className="section-shell flex flex-col justify-start py-5 sm:py-8 md:min-h-[calc(100svh-4.5rem)] md:justify-center md:py-14">
          <div className="mx-auto w-full max-w-5xl">
            <MobileHomeLaunchpad
              featured={featured}
              schools={spotlights.map((item) => item.school)}
            />

            <div className="mx-auto hidden max-w-4xl md:block">
              <SearchCombobox placeholder="Search a school, course code, or professor" />
            </div>

            <div className="mx-auto mt-6 hidden max-w-3xl text-center md:block">
              <h1 className="display-title text-4xl font-semibold leading-[0.94] tracking-[-0.07em] text-balance sm:text-6xl">
                Find the professor who actually gives A&apos;s.
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-ivory/76 sm:text-lg">
                Grade distributions, not just opinions, for {coverage.searchableSchools} searchable schools across the US.
              </p>
            </div>

            <div className="mx-auto mt-6 hidden max-w-4xl flex-wrap items-center justify-center gap-3 text-sm text-ivory/82 md:flex">
              <InlineStat label="Searchable schools" value={coverage.searchableSchools} />
              <InlineStat label="Planner-ready schools" value={coverage.plannerReadySchools} />
              <InlineStat label="Evidence-ready schools" value={coverage.evidenceReadySchools ?? 0} />
            </div>

            <div className="mt-4 grid gap-3 md:hidden">
              <div className="rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,25,44,0.72),rgba(8,25,44,0.56))] p-4 text-white shadow-[0_20px_44px_rgba(4,12,24,0.24)] backdrop-blur-xl">
                <p className="eyebrow text-white/72">Why it feels different</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <MobileProof value={coverage.searchableSchools} label="searchable" />
                  <MobileProof value={coverage.plannerReadySchools} label="planner-ready" />
                  <MobileProof value={coverage.evidenceReadySchools ?? 0} label="evidence-ready" />
                </div>
              </div>
              {spotlight ? (
                <div className="rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,25,44,0.72),rgba(8,25,44,0.56))] p-4 text-white shadow-[0_20px_44px_rgba(4,12,24,0.24)] backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="eyebrow text-white/72">Active school spotlight</p>
                      <p className="mt-1 text-base font-semibold text-white">
                        {spotlight.school.shortName}
                      </p>
                    </div>
                    <CoverageBadge tier={spotlight.school.coverageTier} variant="onDark" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/72">
                    {spotlight.school.sourceStatus.note}
                  </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/schools/${spotlight.school.slug}`}
                        className="inline-flex min-h-11 items-center rounded-full bg-ivory px-4 text-sm font-medium !text-deep-ink"
                      >
                        Open school hub
                      </Link>
                      <Link
                        href="/compare"
                        className="inline-flex min-h-11 items-center rounded-full border border-white/16 bg-white/8 px-4 text-sm font-medium !text-white"
                      >
                        Compare options
                      </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="section-shell hidden py-12 sm:py-28 md:block">
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
              <p className="eyebrow">Featured picks</p>
              <div className="mt-5 space-y-3">
                {featured.slice(0, 4).map((item) => (
                  <Link
                    key={item.id}
                    href={`/schools/${item.schoolSlug}/professors/${item.professorSlug}`}
                    className="block rounded-[24px] border border-white/10 bg-white/6 p-4 transition hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-white">{item.professorName}</p>
                        <p className="text-sm text-white/75">
                          {item.courseCode} - {item.courseName}
                        </p>
                      </div>
                      <CoverageBadge tier={item.coverageTier} variant="onDark" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-white/90">
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        {scoreToLabel(item.classifyScore)}{" "}
                        <span className="text-white/60">(score {formatScore(item.classifyScore)})</span>
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

        <section className="section-shell hidden py-20 sm:py-28 md:block">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="soft-panel rounded-[34px] p-6 text-ink sm:p-8">
              <p className="eyebrow">National school graph</p>
              <h2 className="display-title mt-4 text-4xl font-semibold">
                One school graph, one planning workflow
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted">
                Every searchable institution lands in the same Classify surface:
                school hub, instructor discovery, and planner entry point first. As
                course catalogs, schedules, and outcome evidence arrive, the same
                workflow simply gets deeper.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {spotlights.map((item) => (
                  <button
                    key={item.school.slug}
                    type="button"
                    onClick={() => setSelectedSchool(item.school.slug)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      selectedSchool === item.school.slug
                        ? "border-deep-ink bg-deep-ink text-ivory"
                        : "border-border bg-white/70 text-ink hover:bg-white"
                    }`}
                  >
                    {item.school.shortName}
                  </button>
                ))}
              </div>
            </div>

            {spotlight ? (
              <div className="glass-line rounded-[34px] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">Selected school</p>
                    <h3 className="display-title mt-2 text-4xl font-semibold">
                      {spotlight.school.shortName}
                    </h3>
                    <p className="mt-2 text-sm text-white/75">
                      {spotlight.school.city}, {spotlight.school.state} - {spotlight.school.kind}
                    </p>
                  </div>
                  <CoverageBadge tier={spotlight.school.coverageTier} variant="onDark" />
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/82">
                  {spotlight.school.sourceStatus.note}
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {spotlight.courses.length ? (
                    spotlight.courses.slice(0, 2).map((course) => (
                      <div
                        key={course.courseSlug}
                        className="rounded-[26px] border border-white/10 bg-white/6 p-4"
                      >
                        <p className="text-lg font-semibold text-white">
                          {course.courseCode} - {course.courseName}
                        </p>
                        <p className="mt-1 text-sm text-white/72">
                          {cleanCourseSummary(course)}
                        </p>
                        <p className="mt-3 text-sm text-white/82">
                          Top pick: {course.topProfessorName}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[26px] border border-dashed border-white/15 px-4 py-10 text-sm text-white/78">
                      This school is searchable today. Local course and schedule depth
                      expands here as institutional and community evidence is published.
                    </div>
                  )}
                  {spotlight.trending[0] ? (
                    <div className="rounded-[26px] border border-white/10 bg-white/6 p-4">
                      <p className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-white/70">
                        <LineChart className="h-4 w-4" />
                        Trend callout
                      </p>
                      <p className="mt-3 text-lg font-semibold text-white">
                        {spotlight.trending[0].professorName}
                      </p>
                      <p className="mt-1 text-sm text-white/75">
                        {spotlight.trending[0].courseCode} is trending{" "}
                        {(spotlight.trending[0].trendDelta ?? 0) >= 0 ? "easier" : "harder"}.
                      </p>
                      <TrendSparkline trend={spotlight.trending[0].trend} className="mt-4" />
                    </div>
                  ) : (
                    <div className="rounded-[26px] border border-dashed border-white/15 px-4 py-10 text-sm text-white/78">
                      Trend callouts appear automatically once the school has enough
                      historical evidence.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="section-shell hidden py-20 sm:py-28 md:block">
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
                Evaluate expected GPA, A-rate, rating, difficulty, and trend in a
                single, clean workspace. It is the missing step between &quot;I heard
                they are good&quot; and &quot;I know which section protects my
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
              <p className="eyebrow">What follows next</p>
              <h2 className="display-title mt-4 text-4xl font-semibold">
                The product is built around a national planning graph
              </h2>
              <p className="mt-4 text-base leading-7 text-white/85">
                Directory records, course catalogs, section schedules, official grade
                outcomes, and confidence-aware enrichment all feed the same app model.
                That is what lets Classify support every school with one consistent
                planning surface before optimizer mode arrives later.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 rounded-full bg-ivory px-5 py-3 text-sm font-semibold !text-deep-ink shadow-md shadow-deep-ink/15"
                >
                  <Search className="h-4 w-4" />
                  Open the search app
                </Link>
                <Link
                  href="/compare"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 py-3 text-sm font-medium text-white shadow-sm shadow-deep-ink/20"
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

function MobileProof({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/8 px-3 py-3 text-white">
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-white/62">{label}</p>
    </div>
  );
}
