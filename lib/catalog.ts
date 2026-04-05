/**
 * Catalog is loaded from published JSON (+ seed fallback). For very large row counts,
 * consider SQLite/Postgres with indexes and optional search_documents — see product roadmap.
 */
import "server-only";

import {
  getAllOfferings as getSeedOfferings,
  getFeaturedOfferings as getSeedFeaturedOfferings,
  getSchools as getSeedSchools,
} from "@/lib/data";
import type {
  CourseGroup,
  DepartmentAggregate,
  EvidenceProfile,
  GradeDistributionSeries,
  ProfessorCourseSummary,
  ProfessorDelta,
  ProfessorProfile,
  PublishedCatalogSnapshot,
  RankingMode,
  School,
  SchoolSupportProfile,
  SectionMeeting,
  TrendPoint,
} from "@/lib/types";
import { estimateGradeBuckets } from "@/lib/grade-distribution-estimate";
import {
  getPublishedCatalogReadTrace,
  getPublishedCatalogSourceInfo,
  readPublishedCatalogSnapshot,
} from "@/lib/published-catalog-source";
import { formatProfessorDisplayName } from "@/lib/professor-display";
import { serverLog } from "@/lib/server-logger";
import {
  buildSchoolAliases,
  deriveSchoolShortName,
  normalizeSchoolText,
} from "@/lib/school-display";
import { slugify } from "@/lib/utils";
import { enrichSummary } from "@/lib/scoring";
import {
  invalidateScorecardDirectoryCache,
  loadScorecardDirectorySchools,
} from "@/lib/scorecard-directory";

const GENERAL_ENGINEERING_DEPARTMENT = "General Engineering";
const GENERAL_ENGINEERING_DEPARTMENT_SLUG = slugify(
  GENERAL_ENGINEERING_DEPARTMENT,
);

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSchoolDisplay(school: School): School {
  const shortName = deriveSchoolShortName(school.name, school.shortName);
  return {
    ...school,
    name: normalizeSchoolText(school.name),
    shortName,
    city: normalizeSchoolText(school.city),
    state: normalizeSchoolText(school.state),
    aliases: buildSchoolAliases(school.name, null, school.aliases, shortName),
  };
}

function clampPct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function courseCodeTokens(courseCode: string) {
  return courseCode
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleFromCourseSlug(courseSlug: string, courseCode: string) {
  const codeTokens = new Set(courseCodeTokens(courseCode).map((token) => token.toLowerCase()));
  const titleTokens = courseSlug
    .split("-")
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !codeTokens.has(token.toLowerCase()));

  if (!titleTokens.length) {
    return normalizeWhitespace(courseCode);
  }

  return titleTokens
    .map((token) =>
      token.length <= 3 && /^[a-z]+$/i.test(token)
        ? token.toUpperCase()
        : token.charAt(0).toUpperCase() + token.slice(1),
    )
    .join(" ");
}

function normalizeCourseNameDisplay(
  courseCode: string,
  courseName: string,
  courseSlug: string,
) {
  const normalizedName = normalizeWhitespace(courseName);
  const normalizedCode = normalizeWhitespace(courseCode);

  if (!normalizedName) {
    return titleFromCourseSlug(courseSlug, courseCode);
  }

  if (normalizedName.toUpperCase() === normalizedCode.toUpperCase()) {
    return titleFromCourseSlug(courseSlug, courseCode);
  }

  const repeatedPrefix = new RegExp(
    `^${escapeRegex(normalizedCode)}\\s*[-:]\\s*`,
    "i",
  );
  const stripped = normalizeWhitespace(normalizedName.replace(repeatedPrefix, ""));

  if (!stripped || stripped.toUpperCase() === normalizedCode.toUpperCase()) {
    return titleFromCourseSlug(courseSlug, courseCode);
  }

  return stripped;
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

function toConfidenceLabel(confidence: number): EvidenceProfile["confidenceLabel"] {
  if (confidence >= 75) {
    return "high";
  }
  if (confidence >= 50) {
    return "medium";
  }
  return "low";
}

function hasOfficialGradeEvidence(offering: ProfessorCourseSummary) {
  return (
    offering.dataCompleteness === "institutional_full" ||
    offering.dataCompleteness === "institutional_partial" ||
    offering.coverageTier === "institutional_only" ||
    offering.coverageTier === "institutional_plus_rmp"
  );
}

function hasRmpEvidence(offering: ProfessorCourseSummary) {
  return (
    offering.coverageTier === "institutional_plus_rmp" ||
    offering.coverageTier === "rmp_only" ||
    offering.sourceLabels.some((label) => /rmp|rate my professors/i.test(label))
  );
}

function resolveRankingMode(
  offering: ProfessorCourseSummary,
  hasSectionPlanning: boolean,
): RankingMode {
  if (offering.expectedGpa != null || offering.aRate != null) {
    return "expected_gpa";
  }
  if (hasSectionPlanning) {
    return "planner_fit";
  }
  return "ease_score";
}

function buildEvidenceProfile(
  offering: ProfessorCourseSummary,
  hasSectionPlanning: boolean,
): EvidenceProfile {
  const sourceKinds = new Set<EvidenceProfile["sourceKinds"][number]>();

  sourceKinds.add("catalog");

  if (hasSectionPlanning) {
    sourceKinds.add("schedule");
  }
  if (hasOfficialGradeEvidence(offering)) {
    sourceKinds.add("official_grades");
  }
  if (hasRmpEvidence(offering)) {
    sourceKinds.add("rmp");
  }
  if (offering.sourceLabels.some((label) => /community|student/i.test(label))) {
    sourceKinds.add("community");
  }
  if (offering.sourceLabels.some((label) => /syllabus/i.test(label))) {
    sourceKinds.add("syllabus");
  }

  return {
    sourceKinds: [...sourceKinds],
    confidenceLabel: toConfidenceLabel(offering.confidence),
    hasOfficialGrades: hasOfficialGradeEvidence(offering),
    hasScheduleData: hasSectionPlanning,
    hasRmp: hasRmpEvidence(offering),
    hasCommunityEvidence: sourceKinds.has("community"),
    hasSyllabusEvidence: sourceKinds.has("syllabus"),
  };
}

function buildSchoolSupportProfile(
  school: School,
  offerings: ProfessorCourseSummary[],
  sectionMeetings: SectionMeeting[],
): SchoolSupportProfile {
  const hasCatalog = offerings.length > 0;
  const hasSections = sectionMeetings.length > 0;
  const hasOfficialGrades = offerings.some(hasOfficialGradeEvidence);
  const hasRmp = offerings.some(hasRmpEvidence);
  const hasCommunityEvidence = offerings.some((item) =>
    item.sourceLabels.some((label) => /community|student/i.test(label)),
  );
  const catalogCompletenessPct = clampPct(hasCatalog ? 100 : 0);
  const sectionCompletenessPct = clampPct(
    hasCatalog ? (new Set(sectionMeetings.map((item) => item.courseSlug)).size / Math.max(new Set(offerings.map((item) => item.courseSlug)).size, 1)) * 100 : 0,
  );
  const meetingTimeCompletenessPct = clampPct(
    hasSections
      ? (sectionMeetings.filter((item) => item.startTime && item.endTime && item.days.length).length /
          Math.max(sectionMeetings.length, 1)) *
        100
      : 0,
  );
  const evidenceCompletenessPct = clampPct(
    offerings.length
      ? (offerings.filter(
          (item) =>
            item.expectedGpa != null ||
            item.aRate != null ||
            item.rmpRating != null ||
            item.rmpDifficulty != null,
        ).length /
          offerings.length) *
        100
      : 0,
  );
  const plannerReadiness: SchoolSupportProfile["plannerReadiness"] =
    hasSections && evidenceCompletenessPct >= 60
      ? "evidence_ready"
      : hasSections
        ? "schedule_ready"
        : hasCatalog
          ? "catalog_ready"
          : "directory_ready";
  const readinessReason =
    plannerReadiness === "evidence_ready"
      ? "Sections and evidence-backed ranking signals are published."
      : plannerReadiness === "schedule_ready"
        ? "Sections are published, but ranking evidence is still partial."
        : plannerReadiness === "catalog_ready"
          ? "Courses and instructors are published, but section timing is still incomplete."
          : "Only school-directory coverage is published so far.";

  return {
    plannerReadiness,
    hasCatalog,
    hasSections,
    hasInstructorDirectory: hasCatalog,
    hasPlanner: true,
    hasOfficialGrades,
    hasRmp,
    hasCommunityEvidence,
    evidenceFreshness: school.sourceStatus.freshness,
    sourceAvailability: [
      ...(hasCatalog ? (["catalog"] as const) : []),
      ...(hasSections ? (["schedule"] as const) : []),
      ...(hasOfficialGrades ? (["official_grades"] as const) : []),
      ...(hasRmp ? (["rmp"] as const) : []),
      ...(hasCommunityEvidence ? (["community"] as const) : []),
    ],
    catalogCompletenessPct,
    sectionCompletenessPct,
    meetingTimeCompletenessPct,
    evidenceCompletenessPct,
    readinessReason,
  };
}

function normalizeSchoolDescriptor(
  supportProfile: SchoolSupportProfile,
) {
  if (supportProfile.plannerReadiness === "evidence_ready") {
    return "Evidence-backed school profile with published sections, instructors, and ranking signals.";
  }

  if (supportProfile.plannerReadiness === "schedule_ready") {
    return "Planner-ready school profile with published course, section, and instructor coverage.";
  }

  if (supportProfile.plannerReadiness === "catalog_ready") {
    return supportProfile.hasOfficialGrades
      ? "Published course and instructor data with evidence-backed ranking signals."
      : "Published course and instructor data with a live planning workflow.";
  }

  return "Universal school profile with the same Classify planning workflow. Course and schedule depth expands as school data is published.";
}

function normalizeSchoolNote(
  supportProfile: SchoolSupportProfile,
) {
  if (supportProfile.plannerReadiness === "evidence_ready") {
    return "This school is ready for evidence-backed planning with published section timing and ranking signals.";
  }

  if (supportProfile.hasOfficialGrades && supportProfile.hasRmp) {
    return "Official school data and external review signals are both available for ranked planning.";
  }

  if (supportProfile.hasOfficialGrades) {
    return "Official school data is live. Additional review enrichment attaches when matches clear publishing thresholds.";
  }

  if (supportProfile.hasCatalog || supportProfile.hasSections) {
    return "This school profile is live with local catalog or schedule data. More evidence layers attach as they are published.";
  }

  return "This school profile is live. Catalog, schedule, and evidence layers attach as local data is published.";
}

function normalizeSchoolPresentation(
  school: School,
  supportProfile: SchoolSupportProfile,
): School {
  return {
    ...school,
    descriptor: normalizeSchoolDescriptor(supportProfile),
    sourceStatus: {
      ...school.sourceStatus,
      note: normalizeSchoolNote(supportProfile),
    },
  };
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

async function readPublishedSnapshot(): Promise<PublishedCatalogSnapshot | null> {
  return readPublishedCatalogSnapshot<PublishedCatalogSnapshot>();
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
  sectionMeetings: SectionMeeting[],
): {
  offerings: ProfessorCourseSummary[];
  departmentAggregates: DepartmentAggregate[];
} {
  const enriched = enrichAllOfferings(mergedOfferings);
  const deduped = dedupeOfferingsByProfessorCourse(enriched).map((offering) => {
    const hasSectionPlanning = sectionMeetings.some(
      (item) =>
        item.schoolSlug === offering.schoolSlug &&
        item.courseSlug === offering.courseSlug,
    );
    const rankingMode = resolveRankingMode(offering, hasSectionPlanning);

    return {
      ...offering,
      hasSectionPlanning,
      rankingMode,
      evidenceProfile: buildEvidenceProfile(offering, hasSectionPlanning),
    };
  });
  const departmentAggregates = deriveDepartmentAggregates(schools, deduped);
  const offerings = attachDepartmentDeltas(deduped, departmentAggregates);
  return { offerings, departmentAggregates };
}

function buildFallbackSnapshot(): PublishedCatalogSnapshot {
  const baseSchools = getSeedSchools();
  const sectionMeetings: SectionMeeting[] = [];
  const { offerings, departmentAggregates } = finalizeOfferingsPipeline(
    baseSchools,
    getSeedOfferings(),
    sectionMeetings,
  );
  const schools = baseSchools.map((school) => {
    const supportProfile = buildSchoolSupportProfile(
      school,
      offerings.filter((item) => item.schoolSlug === school.slug),
      sectionMeetings.filter((item) => item.schoolSlug === school.slug),
    );

    return normalizeSchoolPresentation(
      {
        ...school,
        supportProfile,
      },
      supportProfile,
    );
  });

  return {
    updatedAt: new Date().toISOString(),
    schools,
    offerings,
    departmentAggregates,
    gradeDistributionSeries: deriveGradeDistributionSeries(offerings),
    sectionMeetings,
    publishMetadata: {
      runId: "seed-fallback",
      activatedAt: new Date().toISOString(),
      source: "seed",
      summary: {
        schoolCount: schools.length,
        offeringCount: offerings.length,
        sectionCount: 0,
        evidenceReadySchoolCount: schools.filter(
          (item) => item.supportProfile?.plannerReadiness === "evidence_ready",
        ).length,
      },
    },
  };
}

/** Dev-only: seed schools plus College Scorecard directory rows (seed wins on slug). Matches production browse breadth when the JSON exists. */
function buildDevFallbackWithDirectory(): PublishedCatalogSnapshot {
  const seedSnap = buildFallbackSnapshot();
  const directorySchools = loadScorecardDirectorySchools();
  if (!directorySchools.length) {
    return seedSnap;
  }

  const mergedSchools = mergeByKey(directorySchools, seedSnap.schools, (s) => s.slug);
  const { offerings, departmentAggregates } = finalizeOfferingsPipeline(
    mergedSchools,
    seedSnap.offerings,
    seedSnap.sectionMeetings ?? [],
  );
  const schools = mergedSchools.map((school) => {
    const supportProfile = buildSchoolSupportProfile(
      school,
      offerings.filter((item) => item.schoolSlug === school.slug),
      (seedSnap.sectionMeetings ?? []).filter((item) => item.schoolSlug === school.slug),
    );

    return normalizeSchoolPresentation(
      {
        ...school,
        supportProfile,
      },
      supportProfile,
    );
  });

  const baseMeta = seedSnap.publishMetadata;
  if (!baseMeta) {
    return {
      ...seedSnap,
      schools,
      offerings,
      departmentAggregates,
      gradeDistributionSeries: deriveGradeDistributionSeries(offerings),
    };
  }

  return {
    ...seedSnap,
    schools,
    offerings,
    departmentAggregates,
    gradeDistributionSeries: deriveGradeDistributionSeries(offerings),
    publishMetadata: {
      ...baseMeta,
      runId: "seed-plus-directory-fallback",
      summary: {
        schoolCount: schools.length,
        offeringCount: offerings.length,
        sectionCount: baseMeta.summary?.sectionCount ?? 0,
        evidenceReadySchoolCount: baseMeta.summary?.evidenceReadySchoolCount ?? 0,
      },
    },
  };
}

function buildDirectoryOnlySnapshot(): PublishedCatalogSnapshot {
  const schools = loadScorecardDirectorySchools();
  return {
    updatedAt: new Date().toISOString(),
    schools,
    offerings: [],
    departmentAggregates: [],
    gradeDistributionSeries: [],
    sectionMeetings: [],
    publishMetadata: {
      runId: "directory-fallback",
      activatedAt: new Date().toISOString(),
      source: "file",
      summary: {
        schoolCount: schools.length,
        offeringCount: 0,
        sectionCount: 0,
        evidenceReadySchoolCount: 0,
      },
    },
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
      courseName: normalizeCourseNameDisplay(
        enriched.courseCode,
        enriched.courseName,
        enriched.courseSlug,
      ),
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

let snapshotPromise: Promise<PublishedCatalogSnapshot> | null = null;

/** Clears the in-memory catalog snapshot (e.g. after republishing data to Supabase). Next request reloads. */
export function invalidateCatalogSnapshotCache() {
  invalidateScorecardDirectoryCache();
  snapshotPromise = null;
}

async function getSnapshot(): Promise<PublishedCatalogSnapshot> {
  if (snapshotPromise) {
    return snapshotPromise;
  }

  snapshotPromise = (async () => {
    try {
      const fallback =
        process.env.NODE_ENV === "production"
          ? buildDirectoryOnlySnapshot()
          : buildDevFallbackWithDirectory();
      const snapshot = await readPublishedSnapshot();
      if (!snapshot) {
        return fallback;
      }

      const schools = mergeByKey(fallback.schools, snapshot.schools, (item) => item.slug).map(
        normalizeSchoolDisplay,
      );
      const sectionMeetings = snapshot.sectionMeetings ?? fallback.sectionMeetings ?? [];
      const mergedOfferings = mergeByKey(
        fallback.offerings,
        snapshot.offerings,
        (item) => item.id,
      );
      const { offerings, departmentAggregates } = finalizeOfferingsPipeline(
        schools,
        mergedOfferings,
        sectionMeetings,
      );
      const schoolsWithSupport = schools.map((school) => {
        const supportProfile = buildSchoolSupportProfile(
          school,
          offerings.filter((item) => item.schoolSlug === school.slug),
          sectionMeetings.filter((item) => item.schoolSlug === school.slug),
        );

        return normalizeSchoolPresentation(
          {
            ...school,
            supportProfile,
          },
          supportProfile,
        );
      });

      return {
        updatedAt: snapshot.updatedAt ?? fallback.updatedAt,
        schools: schoolsWithSupport,
        offerings,
        departmentAggregates,
        gradeDistributionSeries: deriveGradeDistributionSeries(offerings),
        sectionMeetings,
        publishMetadata:
          snapshot.publishMetadata ?? {
            runId: "merged-runtime-snapshot",
            activatedAt: snapshot.updatedAt ?? fallback.updatedAt,
            source: "db",
            summary: {
              schoolCount: schoolsWithSupport.length,
              offeringCount: offerings.length,
              sectionCount: sectionMeetings.length,
              evidenceReadySchoolCount: schoolsWithSupport.filter(
                (item) => item.supportProfile?.plannerReadiness === "evidence_ready",
              ).length,
            },
          },
      };
    } catch (err) {
      serverLog.error("catalog_snapshot_failed", { error: String(err) });
      return process.env.NODE_ENV === "production"
        ? buildDirectoryOnlySnapshot()
        : buildDevFallbackWithDirectory();
    }
  })();

  return snapshotPromise;
}

export async function getCatalogSchools() {
  return (await getSnapshot()).schools;
}

export async function getCatalogSourceInfo() {
  return getPublishedCatalogSourceInfo();
}

/** Last published-layer load: `db` = Supabase snapshot, `file` = published_catalog.json (dev only), `none` = seed only. */
export function getCatalogDataOriginTrace() {
  return getPublishedCatalogReadTrace();
}

export async function getCatalogOfferings() {
  return (await getSnapshot()).offerings;
}

export async function getCatalogCoverageStats() {
  const snapshot = await getSnapshot();
  const searchableSchools = snapshot.schools.length;
  const evidenceReadySchools = snapshot.schools.filter(
    (school) => school.supportProfile?.plannerReadiness === "evidence_ready",
  ).length;
  const scheduleReadySchools = snapshot.schools.filter(
    (school) => school.supportProfile?.plannerReadiness === "schedule_ready",
  ).length;
  const catalogReadySchools = snapshot.schools.filter(
    (school) => school.supportProfile?.plannerReadiness === "catalog_ready",
  ).length;
  const plannerReadySchools = snapshot.schools.filter(
    (school) =>
      school.supportProfile?.plannerReadiness === "catalog_ready" ||
      school.supportProfile?.plannerReadiness === "schedule_ready" ||
      school.supportProfile?.plannerReadiness === "evidence_ready",
  ).length;
  const trackedCourses = new Set(
    snapshot.offerings.map((item) => `${item.schoolSlug}:${item.courseSlug}`),
  ).size;
  const trackedProfessors = new Set(
    snapshot.offerings.map((item) => `${item.schoolSlug}:${item.professorSlug}`),
  ).size;

  return {
    searchableSchools,
    trackedSchools: searchableSchools,
    institutionalSchools: snapshot.schools.filter(
      (school) => school.supportProfile?.hasOfficialGrades,
    ).length,
    plannerReadySchools,
    catalogReadySchools,
    scheduleReadySchools,
    evidenceReadySchools,
    trackedCourses,
    trackedProfessors,
  };
}

export async function getFeaturedOfferings() {
  const offerings = await getCatalogOfferings();
  return offerings.length
    ? [...offerings]
        .sort((left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0))
        .slice(0, 6)
    : getSeedFeaturedOfferings();
}

export async function getCatalogSchoolBySlug(slug: string) {
  return (await getCatalogSchools()).find((school) => school.slug === slug);
}

export async function getCatalogUpdatedAt() {
  return (await getSnapshot()).updatedAt;
}

export async function getCatalogPublishMetadata() {
  return (await getSnapshot()).publishMetadata ?? null;
}

export async function getCatalogReadinessSummary() {
  const schools = await getCatalogSchools();
  return {
    totalSchools: schools.length,
    directoryReady: schools.filter(
      (school) => school.supportProfile?.plannerReadiness === "directory_ready",
    ).length,
    catalogReady: schools.filter(
      (school) => school.supportProfile?.plannerReadiness === "catalog_ready",
    ).length,
    scheduleReady: schools.filter(
      (school) => school.supportProfile?.plannerReadiness === "schedule_ready",
    ).length,
    evidenceReady: schools.filter(
      (school) => school.supportProfile?.plannerReadiness === "evidence_ready",
    ).length,
  };
}

export async function getCatalogOfferingsForSchool(schoolSlug: string) {
  return (await getCatalogOfferings()).filter((offering) => offering.schoolSlug === schoolSlug);
}

export async function getCatalogSectionMeetingsForSchool(schoolSlug: string) {
  return ((await getSnapshot()).sectionMeetings ?? []).filter(
    (item) => item.schoolSlug === schoolSlug,
  );
}

export async function getCourseGroupsForSchool(schoolSlug: string): Promise<CourseGroup[]> {
  const groups = new Map<string, ProfessorCourseSummary[]>();
  for (const offering of await getCatalogOfferingsForSchool(schoolSlug)) {
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

export async function getCourseGroup(schoolSlug: string, courseSlug: string) {
  return (await getCourseGroupsForSchool(schoolSlug)).find((course) => course.courseSlug === courseSlug);
}

export async function getCourseOfferings(schoolSlug: string, courseSlug: string) {
  return (await getCatalogOfferings())
    .filter(
      (offering) =>
        offering.schoolSlug === schoolSlug && offering.courseSlug === courseSlug,
    )
    .sort((left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0));
}

export async function getProfessorProfile(
  schoolSlug: string,
  professorSlug: string,
): Promise<ProfessorProfile | undefined> {
  const school = await getCatalogSchoolBySlug(schoolSlug);
  const matches = (await getCatalogOfferings()).filter(
    (offering) =>
      offering.schoolSlug === schoolSlug &&
      offering.professorSlug === professorSlug,
  );
  if (!school || matches.length === 0) {
    return undefined;
  }

  return { school, offerings: matches, professor: matches[0] };
}

export async function getDepartmentAggregatesForSchool(schoolSlug: string) {
  return ((await getSnapshot()).departmentAggregates ?? []).filter(
    (item) => item.schoolSlug === schoolSlug,
  );
}

export async function getDepartmentAggregate(
  schoolSlug: string,
  departmentSlug: string,
) {
  return (await getDepartmentAggregatesForSchool(schoolSlug)).find(
    (item) => item.departmentSlug === departmentSlug,
  );
}

export async function getDepartmentOfferingsForSchool(
  schoolSlug: string,
  departmentSlug: string,
) {
  const offerings = await getCatalogOfferingsForSchool(schoolSlug);

  if (departmentSlug === GENERAL_ENGINEERING_DEPARTMENT_SLUG) {
    return offerings.filter((item) => isGeneralEngineeringOffering(item));
  }

  return offerings.filter((item) => slugify(item.department) === departmentSlug);
}

export async function getGradeDistributionSeriesForOffering(offeringId: string) {
  return ((await getSnapshot()).gradeDistributionSeries ?? [])
    .filter((item) => item.offeringId === offeringId)
    .sort((left, right) => left.term.localeCompare(right.term));
}

export async function getGradeDistributionSeriesForCourse(
  schoolSlug: string,
  courseSlug: string,
) {
  const series = ((await getSnapshot()).gradeDistributionSeries ?? []).filter(
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

export async function getCourseTrend(
  schoolSlug: string,
  courseSlug: string,
) {
  const offerings = await getCourseOfferings(schoolSlug, courseSlug);
  return aggregateTrend(
    offerings.map((offering) => ({
      trend: offering.trend,
      sampleSize: offering.sampleSize,
    })),
  );
}

export async function getSchoolTrendSpotlight(slug: string) {
  const school = await getCatalogSchoolBySlug(slug);
  if (!school) return undefined;

  const schoolOfferings = await getCatalogOfferingsForSchool(slug);
  const departments = await getDepartmentAggregatesForSchool(slug);
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
    courses: (await getCourseGroupsForSchool(slug)).slice(0, 6),
    trending: [...schoolOfferings]
      .filter((offering) => offering.trendDelta != null)
      .sort((left, right) => (right.trendDelta ?? 0) - (left.trendDelta ?? 0))
      .slice(0, 3),
    departments: spotlightDepartments,
  };
}

export async function getHiddenGemsForSchool(schoolSlug: string) {
  const offerings = (await getCatalogOfferingsForSchool(schoolSlug)).filter(
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

export { loadScorecardDirectorySchools } from "@/lib/scorecard-directory";
