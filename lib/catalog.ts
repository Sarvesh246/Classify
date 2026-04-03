/**
 * Catalog is loaded from published JSON (+ seed fallback). For very large row counts,
 * consider SQLite/Postgres with indexes and optional search_documents — see product roadmap.
 */
import "server-only";

import fs from "node:fs";
import path from "node:path";
import {
  getAllOfferings as getSeedOfferings,
  getFeaturedOfferings as getSeedFeaturedOfferings,
  getSchools as getSeedSchools,
} from "@/lib/data";
import type {
  CourseGroup,
  DepartmentAggregate,
  GradeDistributionSeries,
  ProfessorCourseSummary,
  ProfessorDelta,
  ProfessorProfile,
  PublishedCatalogSnapshot,
  School,
  TrendPoint,
} from "@/lib/types";
import { estimateGradeBuckets } from "@/lib/grade-distribution-estimate";
import { formatProfessorDisplayName } from "@/lib/professor-display";
import { serverLog } from "@/lib/server-logger";
import { slugify } from "@/lib/utils";
import { enrichSummary } from "@/lib/scoring";

const PUBLISHED_CATALOG_PATH = path.join(
  process.cwd(),
  "etl",
  "output",
  "published_catalog.json",
);

const GENERAL_ENGINEERING_DEPARTMENT = "General Engineering";
const GENERAL_ENGINEERING_DEPARTMENT_SLUG = slugify(
  GENERAL_ENGINEERING_DEPARTMENT,
);

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function weightedAverage(items: number[], weights: number[]) {
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (!totalWeight) {
    return null;
  }

  const total = items.reduce((sum, value, index) => sum + value * weights[index], 0);
  return total / totalWeight;
}

function coverageRank(tier: School["coverageTier"]) {
  switch (tier) {
    case "institutional_plus_rmp":
      return 3;
    case "institutional_only":
      return 2;
    case "rmp_only":
      return 1;
    default:
      return 0;
  }
}

function pickCoverageTier(offerings: ProfessorCourseSummary[]): School["coverageTier"] {
  return offerings.reduce<School["coverageTier"]>(
    (best, item) =>
      coverageRank(item.coverageTier) > coverageRank(best) ? item.coverageTier : best,
    "rmp_only",
  );
}

function deriveGradeDistributionSeries(
  offerings: ProfessorCourseSummary[],
): GradeDistributionSeries[] {
  return offerings.flatMap((offering) => {
    const termWeight = Math.max(
      Math.round(offering.sampleSize / Math.max(offering.trend.length, 1)),
      12,
    );

    return offering.trend
      .filter((point) => point.avgGpa != null || point.aPct != null)
      .map((point, index) => ({
        id: `${offering.id}:${slugify(point.term)}:${index}`,
        offeringId: offering.id,
        schoolSlug: offering.schoolSlug,
        courseSlug: offering.courseSlug,
        professorSlug: offering.professorSlug,
        term: point.term,
        sampleSize: termWeight,
        avgGpa: point.avgGpa,
        sourceLabel: offering.sourceLabels[0] ?? "Published aggregate",
        estimated: true,
        buckets: estimateGradeBuckets(termWeight, point.avgGpa, point.aPct),
      }));
  });
}

function isGeneralEngineeringOffering(offering: ProfessorCourseSummary) {
  const courseCode = offering.courseCode.toUpperCase();
  const courseSlug = offering.courseSlug.toLowerCase();
  const courseName = offering.courseName.toLowerCase();
  const isEngineeringDepartment = /engineering/i.test(offering.department);
  const isFirstYearEngineeringCode =
    /^ENGR\s*1\d{2}\b/i.test(courseCode) || courseSlug.startsWith("engr-1");
  const isGatewayEngineeringCourse =
    /engineering lab i|engineering lab 1|introduction to engineering|intro to engineering|engineering foundations|first-year engineering|general engineering/i.test(
      courseName,
    );

  return isEngineeringDepartment && (isFirstYearEngineeringCode || isGatewayEngineeringCourse);
}

function buildDepartmentAggregate(
  schools: School[],
  schoolSlug: string,
  department: string,
  items: ProfessorCourseSummary[],
): DepartmentAggregate {
  const school = schools.find((entry) => entry.slug === schoolSlug);
  const gpaValues = items
    .filter((item) => item.expectedGpa != null)
    .map((item) => item.expectedGpa as number);
  const gpaWeights = items
    .filter((item) => item.expectedGpa != null)
    .map((item) => Math.max(item.sampleSize, 1));
  const aValues = items
    .filter((item) => item.aRate != null)
    .map((item) => item.aRate as number);
  const aWeights = items
    .filter((item) => item.aRate != null)
    .map((item) => Math.max(item.sampleSize, 1));
  const scoreValues = items
    .filter((item) => item.classifyScore != null)
    .map((item) => item.classifyScore as number);
  const scoreWeights = items
    .filter((item) => item.classifyScore != null)
    .map((item) => Math.max(item.sampleSize, 1));
  const ranked = [...items].sort(
    (left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0),
  );

  return {
    schoolSlug,
    schoolName: school?.name ?? schoolSlug,
    department,
    departmentSlug: slugify(department),
    professorCount: new Set(items.map((item) => item.professorSlug)).size,
    courseCount: new Set(items.map((item) => item.courseSlug)).size,
    coverageTier: pickCoverageTier(items),
    avgClassifyScore:
      scoreValues.length && scoreWeights.length
        ? round(weightedAverage(scoreValues, scoreWeights) ?? 0, 1)
        : null,
    avgExpectedGpa:
      gpaValues.length && gpaWeights.length
        ? round(weightedAverage(gpaValues, gpaWeights) ?? 0, 2)
        : null,
    avgARate:
      aValues.length && aWeights.length
        ? round(weightedAverage(aValues, aWeights) ?? 0, 1)
        : null,
    sampleSize: items.reduce((sum, item) => sum + item.sampleSize, 0),
    latestFreshness: ranked[0]?.freshness ?? school?.sourceStatus.freshness ?? "Unknown",
    topProfessorName: ranked[0]?.professorName ?? "Unavailable",
  };
}

function deriveDepartmentAggregates(
  schools: School[],
  offerings: ProfessorCourseSummary[],
): DepartmentAggregate[] {
  const groups = new Map<string, ProfessorCourseSummary[]>();

  for (const offering of offerings) {
    const key = `${offering.schoolSlug}:${offering.department}`;
    groups.set(key, [...(groups.get(key) ?? []), offering]);
  }

  for (const school of schools) {
    const generalEngineeringOfferings = offerings.filter(
      (item) => item.schoolSlug === school.slug && isGeneralEngineeringOffering(item),
    );
    if (generalEngineeringOfferings.length > 0) {
      groups.set(
        `${school.slug}:${GENERAL_ENGINEERING_DEPARTMENT}`,
        generalEngineeringOfferings,
      );
    }
  }

  return [...groups.entries()]
    .map(([key, items]) => {
      const [schoolSlug, department] = key.split(":");
      return buildDepartmentAggregate(schools, schoolSlug, department, items);
    })
    .sort((left, right) => {
      const scoreDelta = (right.avgClassifyScore ?? 0) - (left.avgClassifyScore ?? 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return left.department.localeCompare(right.department);
    });
}

function buildProfessorDelta(
  offering: ProfessorCourseSummary,
  aggregate: DepartmentAggregate | undefined,
): ProfessorDelta | undefined {
  if (!aggregate) {
    return undefined;
  }

  return {
    department: aggregate.department,
    baselineLabel: "vs last 3 academic years of department data",
    classifyScoreDelta:
      offering.classifyScore == null || aggregate.avgClassifyScore == null
        ? null
        : round(offering.classifyScore - aggregate.avgClassifyScore, 1),
    expectedGpaDelta:
      offering.expectedGpa == null || aggregate.avgExpectedGpa == null
        ? null
        : round(offering.expectedGpa - aggregate.avgExpectedGpa, 2),
    aRateDelta:
      offering.aRate == null || aggregate.avgARate == null
        ? null
        : round(offering.aRate - aggregate.avgARate, 1),
  };
}

function attachDepartmentDeltas(
  offerings: ProfessorCourseSummary[],
  departmentAggregates: DepartmentAggregate[],
) {
  const lookup = new Map(
    departmentAggregates.map((item) => [`${item.schoolSlug}:${item.department}`, item]),
  );

  return offerings.map((offering) => ({
    ...offering,
    departmentDelta: buildProfessorDelta(
      offering,
      lookup.get(`${offering.schoolSlug}:${offering.department}`),
    ),
  }));
}

function readPublishedSnapshot(): PublishedCatalogSnapshot | null {
  if (!fs.existsSync(PUBLISHED_CATALOG_PATH)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(PUBLISHED_CATALOG_PATH, "utf8")) as PublishedCatalogSnapshot;
  } catch (err) {
    serverLog.warn("published_catalog_read_failed", {
      path: PUBLISHED_CATALOG_PATH,
      error: String(err),
    });
    return null;
  }
}

function dedupeOfferingsByProfessorCourse(
  items: ProfessorCourseSummary[],
): ProfessorCourseSummary[] {
  const map = new Map<string, ProfessorCourseSummary>();
  for (const o of items) {
    const key = `${o.schoolSlug}:${o.professorSlug}:${o.courseSlug}`;
    const prev = map.get(key);
    if (!prev || o.sampleSize > prev.sampleSize) {
      map.set(key, o);
    }
  }
  return [...map.values()];
}

function finalizeOfferingsPipeline(
  schools: School[],
  mergedOfferings: ProfessorCourseSummary[],
): {
  offerings: ProfessorCourseSummary[];
  departmentAggregates: DepartmentAggregate[];
} {
  const enriched = enrichAllOfferings(mergedOfferings);
  const deduped = dedupeOfferingsByProfessorCourse(enriched);
  const departmentAggregates = deriveDepartmentAggregates(schools, deduped);
  const offerings = attachDepartmentDeltas(deduped, departmentAggregates);
  return { offerings, departmentAggregates };
}

function buildFallbackSnapshot(): PublishedCatalogSnapshot {
  const schools = getSeedSchools();
  const { offerings, departmentAggregates } = finalizeOfferingsPipeline(schools, getSeedOfferings());

  return {
    updatedAt: new Date().toISOString(),
    schools,
    offerings,
    departmentAggregates,
    gradeDistributionSeries: deriveGradeDistributionSeries(offerings),
    sectionMeetings: [],
  };
}

/** Seed snapshot for merge scripts and tests (no published_catalog.json). */
export function buildSeedCatalogSnapshot(): PublishedCatalogSnapshot {
  return buildFallbackSnapshot();
}

function stripForEnrichment(
  item: ProfessorCourseSummary,
): Parameters<typeof enrichSummary>[0] {
  const { classifyScore: _cs, confidence: _cf, trendDelta: _td, trend, ...rest } = item;
  void _cs;
  void _cf;
  void _td;

  return {
    ...rest,
    trend: trend.map(({ classifyScore: _c, ...t }) => {
      void _c;
      return t;
    }),
  };
}

function enrichAllOfferings(offerings: ProfessorCourseSummary[]): ProfessorCourseSummary[] {
  return offerings.map((item) => {
    const enriched = enrichSummary(stripForEnrichment(item));
    return {
      ...enriched,
      professorName: formatProfessorDisplayName(enriched.professorName),
    };
  });
}

function mergeByKey<T>(
  base: T[],
  incoming: T[] | undefined,
  getKey: (item: T) => string,
) {
  const merged = new Map(base.map((item) => [getKey(item), item]));
  for (const item of incoming ?? []) {
    merged.set(getKey(item), item);
  }
  return [...merged.values()];
}

function getSnapshot(): PublishedCatalogSnapshot {
  try {
    const fallback = buildFallbackSnapshot();
    const snapshot = readPublishedSnapshot();
    if (!snapshot) {
      return fallback;
    }

    const schools = mergeByKey(fallback.schools, snapshot.schools, (item) => item.slug);
    const mergedOfferings = mergeByKey(
      fallback.offerings,
      snapshot.offerings,
      (item) => item.id,
    );
    const { offerings, departmentAggregates } = finalizeOfferingsPipeline(schools, mergedOfferings);

    return {
      updatedAt: snapshot.updatedAt ?? fallback.updatedAt,
      schools,
      offerings,
      departmentAggregates,
      gradeDistributionSeries: deriveGradeDistributionSeries(offerings),
      sectionMeetings: snapshot.sectionMeetings ?? fallback.sectionMeetings,
    };
  } catch (err) {
    serverLog.error("catalog_snapshot_failed", { error: String(err) });
    return buildFallbackSnapshot();
  }
}

export function getCatalogSchools() {
  return getSnapshot().schools;
}

export function getCatalogOfferings() {
  return getSnapshot().offerings;
}

export function getCatalogCoverageStats() {
  const snapshot = getSnapshot();
  const trackedCourses = new Set(
    snapshot.offerings.map((item) => `${item.schoolSlug}:${item.courseSlug}`),
  ).size;
  const trackedProfessors = new Set(
    snapshot.offerings.map((item) => `${item.schoolSlug}:${item.professorSlug}`),
  ).size;

  return {
    trackedSchools: snapshot.schools.length,
    institutionalSchools: snapshot.schools.filter(
      (school) => school.coverageTier !== "rmp_only",
    ).length,
    trackedCourses,
    trackedProfessors,
  };
}

export function getFeaturedOfferings() {
  const offerings = getCatalogOfferings();
  return offerings.length
    ? [...offerings]
        .sort((left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0))
        .slice(0, 6)
    : getSeedFeaturedOfferings();
}

export function getCatalogSchoolBySlug(slug: string) {
  return getCatalogSchools().find((school) => school.slug === slug);
}

export function getCatalogOfferingsForSchool(schoolSlug: string) {
  return getCatalogOfferings().filter((offering) => offering.schoolSlug === schoolSlug);
}

export function getCourseGroupsForSchool(schoolSlug: string): CourseGroup[] {
  const groups = new Map<string, ProfessorCourseSummary[]>();
  for (const offering of getCatalogOfferingsForSchool(schoolSlug)) {
    groups.set(offering.courseSlug, [...(groups.get(offering.courseSlug) ?? []), offering]);
  }

  return [...groups.values()]
    .map((items) => {
      const top = [...items].sort(
        (left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0),
      )[0];
      return {
        schoolSlug,
        courseSlug: top.courseSlug,
        courseCode: top.courseCode,
        courseName: top.courseName,
        department: top.department,
        summary: top.courseSummary,
        coverageTier: top.coverageTier,
        offeringCount: items.length,
        topClassifyScore: top.classifyScore,
        topExpectedGpa: Math.max(...items.map((item) => item.expectedGpa ?? 0)) || null,
        topProfessorName: top.professorName,
        freshness: top.freshness,
      };
    })
    .sort((left, right) => (right.topClassifyScore ?? 0) - (left.topClassifyScore ?? 0));
}

export function getCourseGroup(schoolSlug: string, courseSlug: string) {
  return getCourseGroupsForSchool(schoolSlug).find((course) => course.courseSlug === courseSlug);
}

export function getCourseOfferings(schoolSlug: string, courseSlug: string) {
  return getCatalogOfferings()
    .filter(
      (offering) =>
        offering.schoolSlug === schoolSlug && offering.courseSlug === courseSlug,
    )
    .sort((left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0));
}

export function getProfessorProfile(
  schoolSlug: string,
  professorSlug: string,
): ProfessorProfile | undefined {
  const school = getCatalogSchoolBySlug(schoolSlug);
  const matches = getCatalogOfferings().filter(
    (offering) =>
      offering.schoolSlug === schoolSlug &&
      offering.professorSlug === professorSlug,
  );
  if (!school || matches.length === 0) {
    return undefined;
  }

  return { school, offerings: matches, professor: matches[0] };
}

export function getDepartmentAggregatesForSchool(schoolSlug: string) {
  return (getSnapshot().departmentAggregates ?? []).filter(
    (item) => item.schoolSlug === schoolSlug,
  );
}

export function getDepartmentAggregate(
  schoolSlug: string,
  departmentSlug: string,
) {
  return getDepartmentAggregatesForSchool(schoolSlug).find(
    (item) => item.departmentSlug === departmentSlug,
  );
}

export function getDepartmentOfferingsForSchool(
  schoolSlug: string,
  departmentSlug: string,
) {
  const offerings = getCatalogOfferingsForSchool(schoolSlug);

  if (departmentSlug === GENERAL_ENGINEERING_DEPARTMENT_SLUG) {
    return offerings.filter((item) => isGeneralEngineeringOffering(item));
  }

  return offerings.filter((item) => slugify(item.department) === departmentSlug);
}

export function getGradeDistributionSeriesForOffering(offeringId: string) {
  return (getSnapshot().gradeDistributionSeries ?? [])
    .filter((item) => item.offeringId === offeringId)
    .sort((left, right) => left.term.localeCompare(right.term));
}

export function getGradeDistributionSeriesForCourse(
  schoolSlug: string,
  courseSlug: string,
) {
  const series = (getSnapshot().gradeDistributionSeries ?? []).filter(
    (item) => item.schoolSlug === schoolSlug && item.courseSlug === courseSlug,
  );

  const grouped = new Map<string, GradeDistributionSeries[]>();
  for (const item of series) {
    grouped.set(item.term, [...(grouped.get(item.term) ?? []), item]);
  }

  return [...grouped.entries()].map(([term, items]) => {
    const sampleSize = items.reduce((sum, item) => sum + item.sampleSize, 0);
    const gpaValues = items
      .filter((item) => item.avgGpa != null)
      .map((item) => item.avgGpa as number);
    const gpaWeights = items
      .filter((item) => item.avgGpa != null)
      .map((item) => item.sampleSize);
    const avgGpa =
      gpaValues.length && gpaWeights.length
        ? round(weightedAverage(gpaValues, gpaWeights) ?? 0, 2)
        : null;
    const buckets = (["A", "B", "C", "D", "F"] as const).map((grade) => {
      const gradeCount = items.reduce((sum, item) => {
        const bucket = item.buckets.find((entry) => entry.grade === grade);
        return sum + (bucket?.count ?? 0);
      }, 0);

      return {
        grade,
        count: gradeCount,
        pct: sampleSize ? round((gradeCount / sampleSize) * 100, 1) : 0,
      };
    });

    return {
      id: `${schoolSlug}:${courseSlug}:${slugify(term)}`,
      offeringId: `${schoolSlug}:${courseSlug}`,
      schoolSlug,
      courseSlug,
      professorSlug: "course-aggregate",
      term,
      sampleSize,
      avgGpa,
      sourceLabel: items[0]?.sourceLabel ?? "Published aggregate",
      estimated: items.some((item) => item.estimated),
      buckets,
    };
  });
}

function aggregateTrend(
  trendSets: Array<{ trend: TrendPoint[]; sampleSize: number }>,
): TrendPoint[] {
  const grouped = new Map<
    string,
    {
      avgGpaValues: number[];
      avgGpaWeights: number[];
      aPctValues: number[];
      aPctWeights: number[];
      classifyScoreValues: number[];
      classifyScoreWeights: number[];
    }
  >();

  for (const item of trendSets) {
    const weight = Math.max(
      Math.round(item.sampleSize / Math.max(item.trend.length, 1)),
      1,
    );
    for (const point of item.trend) {
      const current = grouped.get(point.term) ?? {
        avgGpaValues: [],
        avgGpaWeights: [],
        aPctValues: [],
        aPctWeights: [],
        classifyScoreValues: [],
        classifyScoreWeights: [],
      };
      if (point.avgGpa != null) {
        current.avgGpaValues.push(point.avgGpa);
        current.avgGpaWeights.push(weight);
      }
      if (point.aPct != null) {
        current.aPctValues.push(point.aPct);
        current.aPctWeights.push(weight);
      }
      if (point.classifyScore != null) {
        current.classifyScoreValues.push(point.classifyScore);
        current.classifyScoreWeights.push(weight);
      }
      grouped.set(point.term, current);
    }
  }

  return [...grouped.entries()].map(([term, item]) => ({
    term,
    avgGpa:
      item.avgGpaValues.length && item.avgGpaWeights.length
        ? round(
            weightedAverage(item.avgGpaValues, item.avgGpaWeights) ?? 0,
            2,
          )
        : null,
    aPct:
      item.aPctValues.length && item.aPctWeights.length
        ? round(weightedAverage(item.aPctValues, item.aPctWeights) ?? 0, 1)
        : null,
    rmpRating: null,
    rmpDifficulty: null,
    classifyScore:
      item.classifyScoreValues.length && item.classifyScoreWeights.length
        ? round(
            weightedAverage(item.classifyScoreValues, item.classifyScoreWeights) ?? 0,
            1,
          )
        : null,
  }));
}

export function getCourseTrend(
  schoolSlug: string,
  courseSlug: string,
) {
  const offerings = getCourseOfferings(schoolSlug, courseSlug);
  return aggregateTrend(
    offerings.map((offering) => ({
      trend: offering.trend,
      sampleSize: offering.sampleSize,
    })),
  );
}

export function getSchoolTrendSpotlight(slug: string) {
  const school = getCatalogSchoolBySlug(slug);
  if (!school) return undefined;

  const schoolOfferings = getCatalogOfferingsForSchool(slug);
  const departments = getDepartmentAggregatesForSchool(slug);
  const generalEngineering = departments.find(
    (item) => item.departmentSlug === GENERAL_ENGINEERING_DEPARTMENT_SLUG,
  );
  const spotlightDepartments = generalEngineering
    ? [
        generalEngineering,
        ...departments.filter(
          (item) => item.departmentSlug !== GENERAL_ENGINEERING_DEPARTMENT_SLUG,
        ),
      ].slice(0, 6)
    : departments.slice(0, 6);

  return {
    school,
    offerings: schoolOfferings,
    courses: getCourseGroupsForSchool(slug).slice(0, 6),
    trending: [...schoolOfferings]
      .filter((offering) => offering.trendDelta != null)
      .sort((left, right) => (right.trendDelta ?? 0) - (left.trendDelta ?? 0))
      .slice(0, 3),
    departments: spotlightDepartments,
  };
}

export function getHiddenGemsForSchool(schoolSlug: string) {
  const offerings = getCatalogOfferingsForSchool(schoolSlug).filter(
    (item) => item.expectedGpa != null && item.aRate != null,
  );

  if (!offerings.length) {
    return [];
  }

  const sortedByEnrollment = [...offerings].sort(
    (left, right) => left.sampleSize - right.sampleSize,
  );
  const enrollmentCutoff = sortedByEnrollment[Math.floor(sortedByEnrollment.length * 0.45)]?.sampleSize ?? 0;

  return offerings
    .filter((item) => item.sampleSize <= enrollmentCutoff)
    .sort((left, right) => {
      const leftValue = (left.classifyScore ?? 0) + (left.aRate ?? 0) * 0.2;
      const rightValue = (right.classifyScore ?? 0) + (right.aRate ?? 0) * 0.2;
      return rightValue - leftValue;
    })
    .slice(0, 4);
}
