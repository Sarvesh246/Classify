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
  EvidenceSourceKind,
  GradeDistributionSeries,
  ProfessorCourseSummary,
  ProfessorCoverageLevel,
  ProfessorDelta,
  ProfessorDirectoryRow,
  ProfessorProfile,
  ProfessorStatsAvailability,
  PublishedCatalogSnapshot,
  RankingMode,
  School,
  SchoolSupportProfile,
  SectionRecord,
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
import { resolveProfessorProfileName } from "@/lib/professor-display";
import { professorLastNameSortKey } from "@/lib/professor-sort";
import { serverLog } from "@/lib/server-logger";
import { applyCacheLife } from "@/lib/cache-utils";
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

const EXACT_COURSE_NAME_DISPLAY_POLISH = new Map<string, string>([
  ["AG LEADERSHIP EDUC AND COMM", "Agricultural Leadership, Education & Communication"],
  ["TEACHING LEARNING AND CULTURE", "Teaching, Learning & Culture"],
  ["VET PHYSIOLOGY AND PHARMACOLOGY", "Veterinary Physiology & Pharmacology"],
  ["RANGELAND WILDLIFE AND FISH MGMT", "Rangeland, Wildlife & Fisheries Management"],
]);

function polishCourseNameDisplay(courseName: string) {
  const exact = EXACT_COURSE_NAME_DISPLAY_POLISH.get(courseName.toUpperCase());
  if (exact) {
    return exact;
  }

  return courseName;
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

  return polishCourseNameDisplay(stripped);
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

function deriveProfessorStatsAvailability(
  hasInstitutionalStats: boolean,
  hasRmp: boolean,
): ProfessorStatsAvailability {
  if (hasInstitutionalStats && hasRmp) {
    return "full";
  }
  if (hasInstitutionalStats) {
    return "partial";
  }
  if (hasRmp) {
    return "rmp_only";
  }
  return "none";
}

function deriveProfessorCoverageLevel(
  hasIdentity: boolean,
  statsAvailability: ProfessorStatsAvailability,
): ProfessorCoverageLevel {
  if (!hasIdentity) {
    return "directory_only";
  }
  if (statsAvailability === "full") {
    return "stats_full";
  }
  if (statsAvailability === "partial" || statsAvailability === "rmp_only") {
    return "stats_partial";
  }
  return "instructor_directory_ready";
}

function sectionRecordHasMeetingTime(section: SectionRecord) {
  return Boolean(section.startTime && section.endTime && section.days.length);
}

function buildSchoolSupportProfile(
  school: School,
  offerings: ProfessorCourseSummary[],
  sections: SectionRecord[] = [],
  sectionMeetings: SectionMeeting[],
  professorDirectory: ProfessorDirectoryRow[] = [],
): SchoolSupportProfile {
  const hasCatalog = offerings.length > 0 || sections.length > 0;
  const hasSections = sections.length > 0 || sectionMeetings.length > 0;
  const hasOfficialGrades = offerings.some(hasOfficialGradeEvidence);
  const hasRmp = offerings.some(hasRmpEvidence);
  const hasCommunityEvidence = offerings.some((item) =>
    item.sourceLabels.some((label) => /community|student/i.test(label)),
  );
  const catalogCompletenessPct = clampPct(hasCatalog ? 100 : 0);
  const sectionCourseCount = new Set(
    [...sections.map((item) => item.courseSlug), ...sectionMeetings.map((item) => item.courseSlug)],
  ).size;
  const sectionCompletenessPct = clampPct(
    hasCatalog
      ? (sectionCourseCount /
          Math.max(new Set(offerings.map((item) => item.courseSlug)).size, 1)) *
          100
      : 0,
  );
  const meetingCompleteCount =
    sections.filter(sectionRecordHasMeetingTime).length ||
    sectionMeetings.filter((item) => item.startTime && item.endTime && item.days.length).length;
  const meetingDenominator = sections.length || sectionMeetings.length;
  const meetingTimeCompletenessPct = clampPct(
    hasSections
      ? (meetingCompleteCount / Math.max(meetingDenominator, 1)) *
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
  const professorCoverageLevel = professorDirectory.some(
    (item) => item.coverageLevel === "stats_full",
  )
    ? "stats_full"
    : professorDirectory.some((item) => item.coverageLevel === "stats_partial")
      ? "stats_partial"
      : professorDirectory.length
        ? "instructor_directory_ready"
        : "directory_only";

  return {
    plannerReadiness,
    hasCatalog,
    hasSections,
    hasInstructorDirectory: professorDirectory.length > 0,
    professorCoverageLevel,
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
  seededProfessorDirectory: ProfessorDirectoryRow[] = [],
): {
  offerings: ProfessorCourseSummary[];
  departmentAggregates: DepartmentAggregate[];
  professorDirectory: ProfessorDirectoryRow[];
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
  const professorDirectory = buildProfessorDirectoryFromOfferings(
    schools,
    offerings,
    sectionMeetings,
    seededProfessorDirectory,
  );
  return { offerings, departmentAggregates, professorDirectory };
}

function buildFallbackSnapshot(): PublishedCatalogSnapshot {
  const baseSchools = getSeedSchools();
  const sectionMeetings: SectionMeeting[] = [];
  const { offerings, departmentAggregates, professorDirectory } = finalizeOfferingsPipeline(
    baseSchools,
    getSeedOfferings(),
    sectionMeetings,
  );
  const schools = baseSchools.map((school) => {
    const supportProfile = buildSchoolSupportProfile(
      school,
      offerings.filter((item) => item.schoolSlug === school.slug),
      [],
      sectionMeetings.filter((item) => item.schoolSlug === school.slug),
      professorDirectory.filter((item) => item.schoolSlug === school.slug),
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
    professorDirectory,
    departmentAggregates,
    gradeDistributionSeries: deriveGradeDistributionSeries(offerings),
    sections: [],
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
  const { offerings, departmentAggregates, professorDirectory } = finalizeOfferingsPipeline(
    mergedSchools,
    seedSnap.offerings,
    seedSnap.sectionMeetings ?? [],
    seedSnap.professorDirectory ?? [],
  );
  const schools = mergedSchools.map((school) => {
    const supportProfile = buildSchoolSupportProfile(
      school,
      offerings.filter((item) => item.schoolSlug === school.slug),
      seedSnap.sections?.filter((item) => item.schoolSlug === school.slug) ?? [],
      (seedSnap.sectionMeetings ?? []).filter((item) => item.schoolSlug === school.slug),
      professorDirectory.filter((item) => item.schoolSlug === school.slug),
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
        professorDirectory,
        sections: seedSnap.sections ?? [],
        departmentAggregates,
        gradeDistributionSeries: deriveGradeDistributionSeries(offerings),
      };
  }

  return {
    ...seedSnap,
      schools,
      offerings,
      professorDirectory,
      sections: seedSnap.sections ?? [],
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
    professorDirectory: [],
      departmentAggregates: [],
      gradeDistributionSeries: [],
      sections: [],
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

async function loadSnapshotUncached(): Promise<PublishedCatalogSnapshot> {
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
      const sections = snapshot.sections ?? fallback.sections ?? [];
      const sectionMeetings = snapshot.sectionMeetings ?? fallback.sectionMeetings ?? [];
    const mergedOfferings = mergeByKey(
      fallback.offerings,
      snapshot.offerings,
      (item) => item.id,
    );
    const { offerings, departmentAggregates, professorDirectory } = finalizeOfferingsPipeline(
      schools,
      mergedOfferings,
      sectionMeetings,
      snapshot.professorDirectory ?? [],
    );
      const schoolsWithSupport = schools.map((school) => {
        const supportProfile = buildSchoolSupportProfile(
          school,
          offerings.filter((item) => item.schoolSlug === school.slug),
          sections.filter((item) => item.schoolSlug === school.slug),
          sectionMeetings.filter((item) => item.schoolSlug === school.slug),
          professorDirectory.filter((item) => item.schoolSlug === school.slug),
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
        professorDirectory,
        sections,
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
}

async function getCachedSnapshot(): Promise<PublishedCatalogSnapshot> {
  "use cache";

  applyCacheLife("minutes");
  return loadSnapshotUncached();
}

async function getSnapshot(): Promise<PublishedCatalogSnapshot> {
  if (snapshotPromise) {
    return snapshotPromise;
  }

  snapshotPromise = getCachedSnapshot();

  return snapshotPromise;
}

export async function getCatalogSchools() {
  return (await getSnapshot()).schools;
}

/** Default first tab on home "National school graph" when that school is planner-tier. */
export const HOME_NATIONAL_GRAPH_PRIMARY_SLUG = "texas-am";

function isPlannerTierSchool(school: School) {
  const tier = school.supportProfile?.plannerReadiness;
  return (
    tier === "catalog_ready" ||
    tier === "schedule_ready" ||
    tier === "evidence_ready"
  );
}

/**
 * Planner-ready schools (catalog / schedule / evidence tiers) for home spotlights — same cohort as coverage stats, not a random slice.
 * Texas A&M first when present; remaining schools sorted by short name. Capped at 8.
 */
export async function getSchoolsForHomeNationalGraphSpotlights() {
  const schools = await getCatalogSchools();
  const plannerTier = schools.filter(isPlannerTierSchool);
  const primary = plannerTier.find((s) => s.slug === HOME_NATIONAL_GRAPH_PRIMARY_SLUG);
  const rest = plannerTier
    .filter((s) => s.slug !== HOME_NATIONAL_GRAPH_PRIMARY_SLUG)
    .sort((a, b) => a.shortName.localeCompare(b.shortName));
  const ordered = primary ? [primary, ...rest] : rest;
  return ordered.slice(0, 8);
}

export async function getCatalogSourceInfo() {
  return getPublishedCatalogSourceInfo();
}

/** Last published-layer load: `db` = Supabase snapshot, `file` = published_catalog.json (dev only), `none` = seed only. */
export function getCatalogDataOriginTrace() {
  return getPublishedCatalogReadTrace();
}

export async function getCatalogOfferings() {
  return (await getSnapshot()).offerings.map((item) => ({
    ...item,
    courseName: normalizeCourseNameDisplay(item.courseCode, item.courseName, item.courseSlug),
  }));
}

export async function getProfessorDirectoryRows() {
  return (await getSnapshot()).professorDirectory ?? [];
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
    (snapshot.professorDirectory ?? snapshot.offerings).map((item) => `${item.schoolSlug}:${item.professorSlug}`),
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

/** Top-K by classify score without sorting the full catalog (offerings can be very large). */
function topOfferingsByClassifyScore(
  offerings: ProfessorCourseSummary[],
  k: number,
): ProfessorCourseSummary[] {
  if (!offerings.length) return [];
  if (offerings.length <= k) {
    return [...offerings].sort(
      (left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0),
    );
  }
  const pool = offerings.slice();
  const result: ProfessorCourseSummary[] = [];
  for (let i = 0; i < k; i++) {
    let bestIdx = 0;
    let bestScore = pool[0] ? (pool[0].classifyScore ?? 0) : -Infinity;
    for (let j = 1; j < pool.length; j++) {
      const s = pool[j].classifyScore ?? 0;
      if (s > bestScore) {
        bestScore = s;
        bestIdx = j;
      }
    }
    result.push(pool[bestIdx]);
    pool.splice(bestIdx, 1);
  }
  return result.sort(
    (left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0),
  );
}

export async function getFeaturedOfferings() {
  "use cache";

  applyCacheLife("minutes");
  const offerings = (await getSnapshot()).offerings;
  return offerings.length
    ? topOfferingsByClassifyScore(offerings, 6)
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

export async function getCatalogOfferingsByIds(ids: string[]) {
  if (!ids.length) {
    return [];
  }

  const wanted = new Set(ids);
  return (await getCatalogOfferings()).filter((offering) => wanted.has(offering.id));
}

export async function getProfessorDirectoryRowsForSchool(schoolSlug: string) {
  return (await getProfessorDirectoryRows()).filter((row) => row.schoolSlug === schoolSlug);
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
  const [directoryRows, offerings, snapshot] = await Promise.all([
    getProfessorDirectoryRowsForSchool(schoolSlug),
    getCatalogOfferings(),
    getSnapshot(),
  ]);
  const professor = directoryRows.find((row) => row.professorSlug === professorSlug);
  const matches = offerings.filter(
    (offering) =>
      offering.schoolSlug === schoolSlug &&
      offering.professorSlug === professorSlug,
  );
  if (!school || !professor) {
    return undefined;
  }

  const professorInitial = professor.professorName.trim().charAt(0).toLowerCase();
  const professorLastName = professorLastNameSortKey(professor.professorName);
  const professorDepartments = new Set(
    professor.departments.map((department) => department.toLowerCase()),
  );
  const professorCoursePrefixes = new Set(
    professor.coursePrefixes.map((prefix) => prefix.toLowerCase()),
  );
  const relatedDirectoryAliases = directoryRows
    .filter((row) => row.professorSlug !== professorSlug)
    .filter((row) => row.professorName.trim().charAt(0).toLowerCase() === professorInitial)
    .filter((row) => professorLastNameSortKey(row.professorName) === professorLastName)
    .filter(
      (row) =>
        row.departments.some((department) =>
          professorDepartments.has(department.toLowerCase()),
        ) ||
        row.coursePrefixes.some((prefix) =>
          professorCoursePrefixes.has(prefix.toLowerCase()),
        ),
    )
    .map((row) => row.professorName);
  const relatedSections = (snapshot.sections ?? []).filter(
    (section) =>
      section.schoolSlug === schoolSlug && section.professorSlug === professorSlug,
  );
  const relatedMeetingNames = (snapshot.sectionMeetings ?? [])
    .filter((meeting) =>
      relatedSections.some((section) => section.id === meeting.sectionId),
    )
    .map((meeting) => meeting.instructorName);
  const displayProfessorName = resolveProfessorProfileName(professor.professorName, [
    professor.professorName,
    ...relatedDirectoryAliases,
    ...matches.map((item) => item.professorName),
    ...relatedSections.map((section) => section.professorName),
    ...relatedMeetingNames,
  ]);

  return { school, offerings: matches, professor, displayProfessorName };
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

function compareProfessorCoverageLevel(
  left: ProfessorCoverageLevel,
  right: ProfessorCoverageLevel,
) {
  const order: Record<ProfessorCoverageLevel, number> = {
    directory_only: 0,
    instructor_directory_ready: 1,
    stats_partial: 2,
    stats_full: 3,
  };
  return order[left] - order[right];
}

function mergeCoverageTier(
  current: ProfessorCourseSummary["coverageTier"],
  next: ProfessorCourseSummary["coverageTier"],
) {
  return coverageRank(next) > coverageRank(current) ? next : current;
}

function buildProfessorDirectoryFromOfferings(
  schools: School[],
  offerings: ProfessorCourseSummary[],
  sectionMeetings: SectionMeeting[],
  seededRows: ProfessorDirectoryRow[] = [],
) {
  const byKey = new Map<string, ProfessorDirectoryRow>();
  const schoolBySlug = new Map(schools.map((school) => [school.slug, school]));

  for (const seeded of seededRows) {
    byKey.set(`${seeded.schoolSlug}:${seeded.professorSlug}`, seeded);
  }

  const grouped = new Map<string, ProfessorCourseSummary[]>();
  for (const offering of offerings) {
    const key = `${offering.schoolSlug}:${offering.professorSlug}`;
    grouped.set(key, [...(grouped.get(key) ?? []), offering]);
  }

  for (const [key, professorOfferings] of grouped.entries()) {
    const top = [...professorOfferings].sort(
      (left, right) => (right.classifyScore ?? 0) - (left.classifyScore ?? 0),
    )[0];
    const school = schoolBySlug.get(top.schoolSlug);
    if (!school) {
      continue;
    }

    const departments = [...new Set(professorOfferings.map((item) => item.department).filter(Boolean))];
    const coursePrefixes = [
      ...new Set(
        professorOfferings
          .map((item) => item.courseCode.split(/\s+/)[0]?.trim().toUpperCase())
          .filter(Boolean),
      ),
    ].sort();
    const courseCodes = [
      ...new Set(professorOfferings.map((item) => item.courseCode).filter(Boolean)),
    ].sort();
    const courseBySlug = new Map<string, { courseCode: string; courseName: string }>();
    for (const o of professorOfferings) {
      if (!courseBySlug.has(o.courseSlug)) {
        courseBySlug.set(o.courseSlug, {
          courseCode: o.courseCode,
          courseName: o.courseName?.trim() || "",
        });
      }
    }
    const coursesTaught = [...courseBySlug.values()].sort((a, b) =>
      a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true }),
    );
    const courseCount = new Set(professorOfferings.map((item) => item.courseSlug)).size;
    const relevantMeetings = sectionMeetings.filter(
      (meeting) =>
        meeting.schoolSlug === top.schoolSlug &&
        professorOfferings.some(
          (item) =>
            item.courseSlug === meeting.courseSlug &&
            formatProfessorDisplayName(meeting.instructorName ?? "").toLowerCase() ===
              top.professorName.toLowerCase(),
        ),
    );
    const hasInstitutionalStats = professorOfferings.some(
      (item) => item.expectedGpa != null || item.aRate != null,
    );
    const hasRmp = professorOfferings.some(
      (item) => item.rmpRating != null || item.rmpDifficulty != null || item.tags.length > 0,
    );
    const statsAvailability = deriveProfessorStatsAvailability(
      hasInstitutionalStats,
      hasRmp,
    );
    const coverageLevel = deriveProfessorCoverageLevel(true, statsAvailability);
    const sourceKinds = [
      ...new Set(
        professorOfferings.flatMap(
          (item) => item.evidenceProfile?.sourceKinds ?? (["catalog"] as EvidenceSourceKind[]),
        ),
      ),
    ];
    const current = byKey.get(key);
    const merged: ProfessorDirectoryRow = {
      id: current?.id ?? key,
      schoolSlug: top.schoolSlug,
      schoolName: school.name,
      professorSlug: top.professorSlug,
      professorName: top.professorName,
      professorTitle: top.professorTitle || current?.professorTitle || departments[0] || "Instructor",
      departments,
      coursePrefixes,
      courseCodes,
      coursesTaught,
      courseCount,
      sectionCount: Math.max(current?.sectionCount ?? 0, relevantMeetings.length),
      coverageTier: current ? mergeCoverageTier(current.coverageTier, top.coverageTier) : top.coverageTier,
      coverageLevel:
        current && compareProfessorCoverageLevel(current.coverageLevel, coverageLevel) > 0
          ? current.coverageLevel
          : coverageLevel,
      statsAvailability:
        current && current.statsAvailability === "full"
          ? current.statsAvailability
          : statsAvailability,
      evidenceFreshness: current?.evidenceFreshness ?? top.freshness,
      sourceKinds: [...new Set([...(current?.sourceKinds ?? []), ...sourceKinds])],
      hasInstitutionalStats: (current?.hasInstitutionalStats ?? false) || hasInstitutionalStats,
      hasRmp: (current?.hasRmp ?? false) || hasRmp,
      hasSchedulePresence: (current?.hasSchedulePresence ?? false) || relevantMeetings.length > 0,
      expectedGpa:
        weightedAverage(
          professorOfferings
            .filter((item) => item.expectedGpa != null)
            .map((item) => item.expectedGpa as number),
          professorOfferings
            .filter((item) => item.expectedGpa != null)
            .map((item) => Math.max(item.sampleSize, 1)),
        ) ?? current?.expectedGpa ?? null,
      aRate:
        weightedAverage(
          professorOfferings
            .filter((item) => item.aRate != null)
            .map((item) => item.aRate as number),
          professorOfferings
            .filter((item) => item.aRate != null)
            .map((item) => Math.max(item.sampleSize, 1)),
        ) ?? current?.aRate ?? null,
      classifyScore:
        weightedAverage(
          professorOfferings
            .filter((item) => item.classifyScore != null)
            .map((item) => item.classifyScore as number),
          professorOfferings
            .filter((item) => item.classifyScore != null)
            .map((item) => Math.max(item.sampleSize, 1)),
        ) ?? current?.classifyScore ?? null,
      rmpRating: top.rmpRating ?? current?.rmpRating ?? null,
      rmpDifficulty: top.rmpDifficulty ?? current?.rmpDifficulty ?? null,
      sampleSize:
        professorOfferings.reduce((sum, item) => sum + item.sampleSize, 0) ||
        current?.sampleSize ||
        0,
      trend: aggregateTrend(
        professorOfferings.map((offering) => ({
          trend: offering.trend,
          sampleSize: offering.sampleSize,
        })),
      ),
      tags: [...new Set([...(current?.tags ?? []), ...professorOfferings.flatMap((item) => item.tags)])],
      summary:
        current?.summary ??
        (courseCodes.length
          ? `Teaches ${courseCodes.slice(0, 3).join(", ")}${courseCodes.length > 3 ? ", and more" : ""}.`
          : `${top.professorName} appears in ${courseCount} course${
              courseCount === 1 ? "" : "s"
            } across ${departments[0] ?? "published"} data.`),
    };

    byKey.set(key, merged);
  }

  return [...byKey.values()].sort((left, right) => {
    const coverage = compareProfessorCoverageLevel(right.coverageLevel, left.coverageLevel);
    if (coverage !== 0) {
      return coverage;
    }
    return professorLastNameSortKey(left.professorName).localeCompare(
      professorLastNameSortKey(right.professorName),
      undefined,
      { sensitivity: "base" },
    );
  });
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
