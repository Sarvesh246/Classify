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
  GradeDistributionBucket,
  GradeDistributionSeries,
  ProfessorCourseSummary,
  ProfessorDelta,
  ProfessorProfile,
  PublishedCatalogSnapshot,
  School,
  TrendPoint,
} from "@/lib/types";
import { slugify } from "@/lib/utils";

const PUBLISHED_CATALOG_PATH = path.join(
  process.cwd(),
  "etl",
  "output",
  "published_catalog.json",
);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

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

function estimateBuckets(
  sampleSize: number,
  avgGpa: number | null,
  aRate: number | null,
): GradeDistributionBucket[] {
  const safeSample = Math.max(sampleSize, 12);
  const aPct = clamp(aRate ?? 0, 8, 96);
  const remaining = clamp(100 - aPct, 4, 92);
  const rigor = avgGpa == null ? 0.65 : clamp((4 - avgGpa) / 2.8, 0.15, 1);

  const rawB = remaining * clamp(0.54 - rigor * 0.16, 0.18, 0.62);
  const rawC = remaining * clamp(0.28 + rigor * 0.08, 0.16, 0.42);
  const rawD = remaining * clamp(0.11 + rigor * 0.04, 0.06, 0.2);
  const rawF = Math.max(remaining - rawB - rawC - rawD, remaining * 0.04);
  const rawTotal = aPct + rawB + rawC + rawD + rawF;

  const normalized = {
    A: (aPct / rawTotal) * 100,
    B: (rawB / rawTotal) * 100,
    C: (rawC / rawTotal) * 100,
    D: (rawD / rawTotal) * 100,
    F: (rawF / rawTotal) * 100,
  };

  const grades = ["A", "B", "C", "D", "F"] as const;
  let assigned = 0;

  return grades.map((grade, index) => {
    const pct = round(normalized[grade], 1);
    const count =
      index === grades.length - 1
        ? Math.max(safeSample - assigned, 0)
        : Math.round((pct / 100) * safeSample);
    assigned += count;

    return {
      grade,
      count,
      pct,
    };
  });
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
        buckets: estimateBuckets(termWeight, point.avgGpa, point.aPct),
      }));
  });
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

  return [...groups.entries()]
    .map(([key, items]) => {
      const [schoolSlug, department] = key.split(":");
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
  } catch {
    return null;
  }
}

function buildFallbackSnapshot(): PublishedCatalogSnapshot {
  const schools = getSeedSchools();
  const baseOfferings = getSeedOfferings();
  const departmentAggregates = deriveDepartmentAggregates(schools, baseOfferings);
  const offerings = attachDepartmentDeltas(baseOfferings, departmentAggregates);

  return {
    updatedAt: new Date().toISOString(),
    schools,
    offerings,
    departmentAggregates,
    gradeDistributionSeries: deriveGradeDistributionSeries(offerings),
    sectionMeetings: [],
  };
}

function getSnapshot(): PublishedCatalogSnapshot {
  const snapshot = readPublishedSnapshot();
  if (!snapshot) {
    return buildFallbackSnapshot();
  }

  const departmentAggregates =
    snapshot.departmentAggregates ??
    deriveDepartmentAggregates(snapshot.schools, snapshot.offerings);
  const offerings = attachDepartmentDeltas(snapshot.offerings, departmentAggregates);

  return {
    ...snapshot,
    offerings,
    departmentAggregates,
    gradeDistributionSeries:
      snapshot.gradeDistributionSeries ?? deriveGradeDistributionSeries(offerings),
    sectionMeetings: snapshot.sectionMeetings ?? [],
  };
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
  return {
    school,
    offerings: schoolOfferings,
    courses: getCourseGroupsForSchool(slug),
    trending: [...schoolOfferings]
      .filter((offering) => offering.trendDelta != null)
      .sort((left, right) => (right.trendDelta ?? 0) - (left.trendDelta ?? 0))
      .slice(0, 3),
    departments: getDepartmentAggregatesForSchool(slug).slice(0, 6),
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
