import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { estimateGradeBuckets } from "../lib/grade-distribution-estimate";
import type {
  ProfessorDirectoryRow,
  SectionRecord,
} from "../lib/types";
import {
  buildSchoolAliases,
  deriveSchoolShortName,
  isMalformedSchoolAlias,
  normalizeSchoolText,
} from "../lib/school-display";

type CoverageTier = "institutional_plus_rmp" | "institutional_only" | "rmp_only";
type PlannerReadiness = "evidence_ready" | "schedule_ready" | "catalog_ready" | "directory_ready";
type DataCompleteness =
  | "institutional_full"
  | "institutional_partial"
  | "rmp_only"
  | "directory_only";
type RankingMode = "expected_gpa" | "ease_score" | "planner_fit";
type EvidenceSourceKind =
  | "official_grades"
  | "schedule"
  | "catalog"
  | "rmp"
  | "community"
  | "syllabus";

type TrendPoint = {
  term: string;
  avgGpa: number | null;
  aPct: number | null;
};

type SchoolRecord = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  aliases?: string[];
  city: string;
  state: string;
  kind: "Public" | "Private";
  coverageTier: CoverageTier;
  sourceStatus: {
    primary: string;
    fallback: string;
    freshness: string;
    note: string;
  };
  supportProfile?: {
    plannerReadiness: PlannerReadiness;
    hasCatalog: boolean;
    hasSections: boolean;
    hasInstructorDirectory: boolean;
    hasPlanner: boolean;
    hasOfficialGrades: boolean;
    hasRmp: boolean;
    hasCommunityEvidence: boolean;
    evidenceFreshness: string;
    sourceAvailability: EvidenceSourceKind[];
    catalogCompletenessPct?: number;
    sectionCompletenessPct?: number;
    meetingTimeCompletenessPct?: number;
    evidenceCompletenessPct?: number;
    readinessReason?: string;
  };
};

type OfferingRecord = {
  id: string;
  schoolSlug: string;
  professorSlug: string;
  courseSlug: string;
  courseCode: string;
  courseName: string;
  professorName: string;
  department: string;
  classifyScore: number | null;
  expectedGpa: number | null;
  aRate: number | null;
  rmpRating: number | null;
  rmpDifficulty: number | null;
  trendDelta: number | null;
  confidence: number;
  sampleSize: number;
  coverageTier: CoverageTier;
  latestTerm: string;
  termCount: number;
  matchConfidence: number;
  tags: string[];
  summary: string;
  professorTitle: string;
  professorSummary: string;
  courseSummary: string;
  freshness: string;
  sourceLabels: string[];
  dataCompleteness: DataCompleteness;
  trend: TrendPoint[];
  rankingMode?: RankingMode;
  hasSectionPlanning?: boolean;
};

export type PublishedCatalogSnapshot = {
  updatedAt: string;
  schools: SchoolRecord[];
  offerings: OfferingRecord[];
  professorDirectory?: ProfessorDirectoryRow[];
  sections?: SectionRecord[];
  publishMetadata?: {
    runId: string;
    activatedAt: string;
    source: "db" | "file" | "seed";
    summary?: {
      schoolCount: number;
      offeringCount: number;
      sectionCount: number;
      evidenceReadySchoolCount: number;
    };
  };
};

type DbSchoolRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  aliases: string[];
  city: string;
  state: string;
  kind: string;
  coverage_tier: CoverageTier;
  source_primary: string;
  source_fallback: string;
  source_note: string;
  planner_readiness: PlannerReadiness;
  has_catalog: boolean;
  has_sections: boolean;
  has_instructor_directory: boolean;
  has_planner: boolean;
  has_official_grades: boolean;
  has_rmp: boolean;
  has_community_evidence: boolean;
  evidence_freshness: string;
  source_availability: EvidenceSourceKind[];
  catalog_completeness_pct: number;
  section_completeness_pct: number;
  meeting_time_completeness_pct: number;
  evidence_completeness_pct: number;
  readiness_reason: string | null;
  refreshed_at: string;
};

type DbProfessorRow = {
  id: string;
  school_id: string;
  slug: string;
  name: string;
  department: string | null;
  title: string | null;
};

type DbCourseRow = {
  id: string;
  school_id: string;
  slug: string;
  code: string;
  name: string;
  department: string | null;
};

type DbSectionRow = {
  id: string;
  school_id: string;
  course_id: string;
  professor_id: string | null;
  term: string;
  source_key: string;
  source_url: string | null;
  instructor_name_raw: string;
  match_status: string;
  sample_size: number;
};

type DbRmpRow = {
  professor_id: string;
  school_id: string;
  rmp_id: string | null;
  rating: number | null;
  difficulty: number | null;
  review_count: number;
  tags: string[];
  matched_confidence: number | null;
  refreshed_at: string;
};

type DbSummaryRow = {
  id: string;
  school_id: string;
  course_id: string;
  professor_id: string;
  coverage_tier: CoverageTier;
  classify_score: number | null;
  expected_gpa: number | null;
  a_rate: number | null;
  trend_delta: number | null;
  confidence: number;
  match_confidence: number;
  freshness_label: string;
  source_labels: string[];
  ranking_mode: RankingMode | null;
  available_evidence_sources: EvidenceSourceKind[];
  has_section_planning: boolean;
  data_completeness: DataCompleteness;
  latest_term: string;
  published_at: string;
};

type DbDepartmentAggregateRow = {
  id: string;
  school_id: string;
  department_slug: string;
  department_name: string;
  metric_window: string;
  coverage_tier: CoverageTier;
  avg_classify_score: number | null;
  avg_expected_gpa: number | null;
  avg_a_rate: number | null;
  professor_count: number;
  course_count: number;
  sample_size: number;
  latest_freshness: string;
  published_at: string;
};

type DbGradeSeriesRow = {
  id: string;
  school_id: string;
  course_id: string;
  professor_id: string;
  summary_id: string;
  term: string;
  sample_size: number;
  avg_gpa: number | null;
  source_label: string;
  estimated: boolean;
  a_count: number;
  b_count: number;
  c_count: number;
  d_count: number;
  f_count: number;
  published_at: string;
};

type PublishPayload = {
  schools: DbSchoolRow[];
  professors: DbProfessorRow[];
  courses: DbCourseRow[];
  sections: DbSectionRow[];
  rmpRatings: DbRmpRow[];
  summaries: DbSummaryRow[];
  departmentAggregates: DbDepartmentAggregateRow[];
  gradeSeries: DbGradeSeriesRow[];
};

type LegacyDbSchoolRow = Omit<
  DbSchoolRow,
  | "aliases"
  | "catalog_completeness_pct"
  | "section_completeness_pct"
  | "meeting_time_completeness_pct"
  | "evidence_completeness_pct"
  | "readiness_reason"
>;

type TableKey =
  | "schools"
  | "professors"
  | "courses"
  | "sections"
  | "rmp_ratings"
  | "published_professor_course_summaries"
  | "department_aggregates"
  | "published_grade_distribution_series";

const ROOT = path.join(process.cwd());
const SNAPSHOT_PATH = path.join(ROOT, "etl", "output", "published_catalog.json");
const DIRECTORY_SNAPSHOT_PATH = path.join(
  ROOT,
  "etl",
  "output",
  "college_scorecard_schools.json",
);
const BATCH_SIZE = 500;
const LEGACY_SCHOOL_SCHEMA_REGEX =
  /aliases|catalog_completeness_pct|section_completeness_pct|meeting_time_completeness_pct|evidence_completeness_pct|readiness_reason/i;

type DirectorySchoolRecord = {
  school_id: number;
  slug: string;
  name: string;
  alias?: string | null;
  city: string;
  state: string;
  control?: string | null;
};

const SCORECARD_SCHOOL_SLUG_CANONICAL: Record<string, string> = {
  "the-university-of-texas-at-austin": "ut-austin",
  "texas-a-m-university-college-station": "texas-am",
  "university-of-california-berkeley": "uc-berkeley",
  "university-of-wisconsin-madison": "uw-madison",
  "the-ohio-state-university-main-campus": "ohio-state",
  "university-of-north-carolina-at-chapel-hill": "unc-chapel-hill",
  "university-of-washington-seattle-campus": "university-of-washington",
  "university-of-illinois-urbana-champaign": "uiuc",
};

const SCORECARD_SCHOOL_ALIAS_EXTRAS: Record<string, string[]> = {
  "ut-austin": ["UT", "UT Austin", "University of Texas", "Texas Austin"],
  "texas-am": ["Texas A&M", "Texas A and M", "TAMU", "A&M", "Texas AM"],
  "uc-berkeley": ["UC Berkeley", "Berkeley", "Cal"],
  "uw-madison": ["UW-Madison", "UW Madison", "Wisconsin", "Madison"],
  "ohio-state": ["Ohio State", "OSU", "The Ohio State University"],
  "unc-chapel-hill": ["UNC", "UNC Chapel Hill", "Carolina"],
  "university-of-washington": ["UW", "University of Washington", "Washington Seattle"],
  uiuc: ["UIUC", "Illinois", "U of I", "University of Illinois"],
};

function loadLocalEnvFile(filename: string) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals <= 0) continue;
    const key = trimmed.slice(0, equals).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export function loadScriptEnv() {
  loadLocalEnvFile(".env.local");
  loadLocalEnvFile(".env");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugifyProfessorName(value: string) {
  return slugify(value.replace(/\./g, " "));
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clampPct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function canonicalScorecardSchoolSlug(rawSlug: string) {
  return SCORECARD_SCHOOL_SLUG_CANONICAL[rawSlug] ?? rawSlug;
}

function directorySchoolToRecord(row: DirectorySchoolRecord): SchoolRecord {
  const slug = canonicalScorecardSchoolSlug(row.slug);
  const shortName = deriveSchoolShortName(row.name, row.alias);
  const aliases = buildSchoolAliases(
    row.name,
    row.alias,
    SCORECARD_SCHOOL_ALIAS_EXTRAS[slug] ?? [],
    shortName,
  );

  return {
    id: `scorecard:${row.school_id}`,
    slug,
    name: normalizeSchoolText(row.name),
    shortName,
    aliases,
    city: normalizeSchoolText(row.city),
    state: normalizeSchoolText(row.state),
    kind: row.control?.includes("Private") ? "Private" : "Public",
    coverageTier: "rmp_only",
    sourceStatus: {
      primary: "College Scorecard directory",
      fallback: "Rate My Professors",
      freshness: "Directory coverage active",
      note: "This school profile is live. Catalog, schedule, and evidence layers attach as local data is published.",
    },
    supportProfile: {
      plannerReadiness: "directory_ready",
      hasCatalog: false,
      hasSections: false,
      hasInstructorDirectory: false,
      hasPlanner: true,
      hasOfficialGrades: false,
      hasRmp: false,
      hasCommunityEvidence: false,
      evidenceFreshness: "Directory coverage active",
      sourceAvailability: [],
      catalogCompletenessPct: 0,
      sectionCompletenessPct: 0,
      meetingTimeCompletenessPct: 0,
      evidenceCompletenessPct: 0,
      readinessReason:
        "School directory is live, but local catalog and schedule data have not been published yet.",
    },
  };
}

function loadDirectorySchoolRecords(): SchoolRecord[] {
  if (!fs.existsSync(DIRECTORY_SNAPSHOT_PATH)) {
    return [];
  }

  const payload = JSON.parse(
    fs.readFileSync(DIRECTORY_SNAPSHOT_PATH, "utf8"),
  ) as DirectorySchoolRecord[];

  return payload.map(directorySchoolToRecord);
}

function mergeDirectorySchools(snapshot: PublishedCatalogSnapshot): PublishedCatalogSnapshot {
  const directorySchools = loadDirectorySchoolRecords();
  if (!directorySchools.length) {
    return snapshot;
  }

  const bySlug = new Map<string, SchoolRecord>();
  for (const school of directorySchools) {
    bySlug.set(school.slug, school);
  }
  for (const school of snapshot.schools) {
    const existing = bySlug.get(school.slug);
    bySlug.set(school.slug, {
      ...existing,
      ...school,
      aliases: [
        ...new Set([...(existing?.aliases ?? []), ...(school.aliases ?? [])]),
      ],
    });
  }

  const publishMetadata = snapshot.publishMetadata
    ? {
        ...snapshot.publishMetadata,
        summary: {
          schoolCount: [...bySlug.values()].length,
          offeringCount: snapshot.offerings.length,
          sectionCount: snapshot.publishMetadata.summary?.sectionCount ?? 0,
          evidenceReadySchoolCount:
            snapshot.publishMetadata.summary?.evidenceReadySchoolCount ?? 0,
        },
      }
    : undefined;

  return {
    ...snapshot,
    schools: [...bySlug.values()],
    publishMetadata,
  };
}

export function readSnapshot(snapshotPath = SNAPSHOT_PATH): PublishedCatalogSnapshot {
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Published catalog snapshot not found at ${snapshotPath}`);
  }

  return JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as PublishedCatalogSnapshot;
}

function chunk<T>(items: T[], size = BATCH_SIZE) {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function hasOfficialGrades(offering: OfferingRecord) {
  return (
    offering.coverageTier === "institutional_only" ||
    offering.coverageTier === "institutional_plus_rmp" ||
    offering.dataCompleteness === "institutional_full" ||
    offering.dataCompleteness === "institutional_partial"
  );
}

function hasRmp(offering: OfferingRecord) {
  return (
    offering.coverageTier === "institutional_plus_rmp" ||
    offering.coverageTier === "rmp_only" ||
    offering.rmpRating != null ||
    offering.rmpDifficulty != null ||
    offering.tags.length > 0 ||
    offering.sourceLabels.some((label) => /rmp|rate my professors/i.test(label))
  );
}

function deriveEvidenceSources(offering: OfferingRecord): EvidenceSourceKind[] {
  const sources = new Set<EvidenceSourceKind>(["catalog"]);
  if (offering.hasSectionPlanning) sources.add("schedule");
  if (hasOfficialGrades(offering)) sources.add("official_grades");
  if (hasRmp(offering)) sources.add("rmp");
  if (offering.sourceLabels.some((label) => /community|student/i.test(label))) sources.add("community");
  if (offering.sourceLabels.some((label) => /syllabus/i.test(label))) sources.add("syllabus");
  return [...sources];
}

function weightedAverage(values: Array<number | null>, weights: number[]) {
  let total = 0;
  let totalWeight = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const weight = weights[index] ?? 0;
    if (value == null || !Number.isFinite(value) || weight <= 0) continue;
    total += value * weight;
    totalWeight += weight;
  }
  return totalWeight ? total / totalWeight : null;
}

function buildCompactPublishedSnapshotArtifact(
  snapshot: PublishedCatalogSnapshot,
  payload: PublishPayload,
) {
  return {
    updatedAt: snapshot.updatedAt,
    schools: [],
    offerings: [],
    professorDirectory: [],
    sections: [],
    publishMetadata: {
      runId: `compact:${new Date().toISOString()}`,
      activatedAt: new Date().toISOString(),
      source: "db" as const,
      summary: {
        schoolCount: payload.schools.length,
        offeringCount: payload.summaries.length,
        sectionCount: payload.sections.length,
        evidenceReadySchoolCount: payload.schools.filter(
          (row) => row.planner_readiness === "evidence_ready",
        ).length,
      },
    },
    artifactMode: "compact",
    compactSummary: {
      schoolSlugs: payload.schools.slice(0, 100).map((row) => row.slug),
      counts: {
        schools: payload.schools.length,
        professors: payload.professors.length,
        courses: payload.courses.length,
        sections: payload.sections.length,
        summaries: payload.summaries.length,
      },
    },
  };
}

function sectionHasMeetingTime(section: SectionRecord) {
  return Boolean(section.startTime && section.endTime && section.days.length);
}

function isTrustedRmpIdentity(row: ProfessorDirectoryRow) {
  return row.hasRmp && (row.rmpRating != null || row.rmpDifficulty != null) && row.sampleSize >= 3;
}

function deriveSchoolSupport(
  school: SchoolRecord,
  offerings: OfferingRecord[],
  professorDirectory: ProfessorDirectoryRow[] = [],
  sections: SectionRecord[] = [],
) {
  const hasCatalog = offerings.length > 0 || sections.length > 0;
  const hasSections =
    sections.length > 0 || offerings.some((item) => item.hasSectionPlanning);
  const hasOfficial = offerings.some(hasOfficialGrades);
  const hasRmpEvidence =
    offerings.some(hasRmp) || professorDirectory.some((item) => item.hasRmp);
  const uniqueCourses = new Set(offerings.map((item) => item.courseSlug)).size;
  const sectionCourses = new Set([
    ...sections.map((item) => item.courseSlug),
    ...offerings.filter((item) => item.hasSectionPlanning).map((item) => item.courseSlug),
  ]).size;
  const catalogCompletenessPct = hasCatalog ? 100 : 0;
  const sectionCompletenessPct = hasCatalog
    ? clampPct((sectionCourses / Math.max(uniqueCourses, 1)) * 100)
    : 0;
  const meetingTimeCompletenessPct = hasSections
    ? clampPct(
        ((sections.filter(sectionHasMeetingTime).length ||
          offerings.filter((item) => item.hasSectionPlanning).length) /
          Math.max(sections.length || offerings.length, 1)) *
          100,
      )
    : 0;
  const evidenceCompletenessPct = offerings.length
    ? clampPct(
        (offerings.filter(
          (item) =>
            item.expectedGpa != null ||
            item.aRate != null ||
            item.rmpRating != null ||
            item.rmpDifficulty != null,
        ).length /
          offerings.length) *
          100,
      )
    : 0;
  const plannerReadiness: PlannerReadiness =
    hasSections && evidenceCompletenessPct >= 60
      ? "evidence_ready"
      : hasSections
        ? "schedule_ready"
        : hasCatalog
          ? "catalog_ready"
          : "directory_ready";

  const sourceAvailability = new Set<EvidenceSourceKind>();
  if (hasCatalog) sourceAvailability.add("catalog");
  if (hasSections) sourceAvailability.add("schedule");
  if (hasOfficial) sourceAvailability.add("official_grades");
  if (hasRmpEvidence) sourceAvailability.add("rmp");

    return {
      plannerReadiness,
      hasCatalog,
      hasSections,
      hasInstructorDirectory: professorDirectory.length > 0 || hasCatalog,
      hasPlanner: true,
      hasOfficialGrades: hasOfficial,
      hasRmp: hasRmpEvidence,
      hasCommunityEvidence: offerings.some((item) =>
        item.sourceLabels.some((label) => /community|student/i.test(label)),
    ),
    evidenceFreshness: school.sourceStatus.freshness,
    sourceAvailability: [...sourceAvailability],
    catalogCompletenessPct,
    sectionCompletenessPct,
    meetingTimeCompletenessPct,
    evidenceCompletenessPct,
    readinessReason:
      plannerReadiness === "evidence_ready"
        ? "Sections and evidence-backed ranking signals are published."
        : plannerReadiness === "schedule_ready"
          ? "Sections are published, but ranking evidence is still partial."
          : plannerReadiness === "catalog_ready"
            ? "Courses and instructors are published, but section timing is still incomplete."
            : "Only school-directory coverage is published so far.",
  };
}

export function buildPayload(snapshot: PublishedCatalogSnapshot): PublishPayload {
  const mergedSchools = mergeDirectorySchools(snapshot).schools;
  const explicitProfessorDirectory = snapshot.professorDirectory ?? [];
  const explicitSections = snapshot.sections ?? [];
  const schoolsWithExplicitSections = new Set(
    explicitSections.map((section) => section.schoolSlug),
  );

  const offeringsBySchool = new Map<string, OfferingRecord[]>();
  for (const offering of snapshot.offerings) {
    offeringsBySchool.set(offering.schoolSlug, [
      ...(offeringsBySchool.get(offering.schoolSlug) ?? []),
      offering,
    ]);
  }

  const schoolIdBySlug = new Map(mergedSchools.map((school) => [school.slug, school.id]));
  const schools: DbSchoolRow[] = mergedSchools.map((school) => {
      const offerings = offeringsBySchool.get(school.slug) ?? [];
      const support = deriveSchoolSupport(
        school,
        offerings,
        explicitProfessorDirectory.filter((item) => item.schoolSlug === school.slug),
        explicitSections.filter((item) => item.schoolSlug === school.slug),
      );
      return {
        id: school.id,
      slug: school.slug,
      name: school.name,
      short_name: school.shortName,
      aliases: school.aliases ?? [],
      city: school.city,
      state: school.state,
      kind: school.kind,
      coverage_tier: school.coverageTier,
      source_primary: school.sourceStatus.primary,
      source_fallback: school.sourceStatus.fallback,
      source_note: school.sourceStatus.note,
      planner_readiness: support.plannerReadiness,
      has_catalog: support.hasCatalog,
      has_sections: support.hasSections,
      has_instructor_directory: support.hasInstructorDirectory,
      has_planner: support.hasPlanner,
      has_official_grades: support.hasOfficialGrades,
      has_rmp: support.hasRmp,
      has_community_evidence: support.hasCommunityEvidence,
      evidence_freshness: support.evidenceFreshness,
      source_availability: support.sourceAvailability,
      catalog_completeness_pct: support.catalogCompletenessPct ?? 0,
      section_completeness_pct: support.sectionCompletenessPct ?? 0,
      meeting_time_completeness_pct: support.meetingTimeCompletenessPct ?? 0,
      evidence_completeness_pct: support.evidenceCompletenessPct ?? 0,
      readiness_reason: support.readinessReason ?? null,
      refreshed_at: snapshot.updatedAt,
    };
  });

  const professorsMap = new Map<string, DbProfessorRow>();
  const coursesMap = new Map<string, DbCourseRow>();
  const courseIdBySchoolCode = new Map<string, string>();
  const sectionsMap = new Map<string, DbSectionRow>();
  const rmpMap = new Map<string, DbRmpRow>();
  const summaries: DbSummaryRow[] = [];
  const departmentBuckets = new Map<string, OfferingRecord[]>();
  const gradeSeries: DbGradeSeriesRow[] = [];

  for (const offering of snapshot.offerings) {
    const schoolId = schoolIdBySlug.get(offering.schoolSlug);
    if (!schoolId) continue;

    const professorId = `prof:${schoolId}:${offering.professorSlug}`;
    if (!professorsMap.has(professorId)) {
      professorsMap.set(professorId, {
        id: professorId,
        school_id: schoolId,
        slug: offering.professorSlug,
        name: offering.professorName,
        department: offering.department,
        title: offering.professorTitle || null,
      });
    }

    const courseId = `course:${schoolId}:${offering.courseSlug}`;
    if (!coursesMap.has(courseId)) {
      coursesMap.set(courseId, {
        id: courseId,
        school_id: schoolId,
        slug: offering.courseSlug,
        code: offering.courseCode,
        name: offering.courseName,
        department: offering.department,
      });
    }
    courseIdBySchoolCode.set(`${schoolId}:${offering.courseCode.trim().toUpperCase()}`, courseId);

    const sectionId = `section:${offering.id}`;
    if (!explicitSections.some((section) => section.supportingOfferingId === offering.id)) {
      sectionsMap.set(sectionId, {
        id: sectionId,
        school_id: schoolId,
        course_id: courseId,
      professor_id: professorId,
      term: offering.latestTerm,
      source_key: slugify(offering.sourceLabels[0] ?? "published_catalog"),
      source_url: null,
      instructor_name_raw: offering.professorName,
        match_status: offering.matchConfidence >= 80 ? "matched" : "review",
        sample_size: offering.sampleSize,
      });
    }

    summaries.push({
      id: offering.id,
      school_id: schoolId,
      course_id: courseId,
      professor_id: professorId,
      coverage_tier: offering.coverageTier,
      classify_score: offering.classifyScore,
      expected_gpa: offering.expectedGpa,
      a_rate: offering.aRate,
      trend_delta: offering.trendDelta,
      confidence: offering.confidence,
      match_confidence: offering.matchConfidence,
      freshness_label: offering.freshness,
      source_labels: offering.sourceLabels,
      ranking_mode: offering.rankingMode ?? null,
      available_evidence_sources: deriveEvidenceSources(offering),
      has_section_planning: Boolean(offering.hasSectionPlanning),
      data_completeness: offering.dataCompleteness,
      latest_term: offering.latestTerm,
      published_at: snapshot.updatedAt,
    });

    if (hasRmp(offering)) {
      const existing = rmpMap.get(professorId);
      const mergedTags = new Set([...(existing?.tags ?? []), ...offering.tags]);
      rmpMap.set(professorId, {
        professor_id: professorId,
        school_id: schoolId,
        rmp_id: null,
        rating:
          existing?.rating != null && offering.rmpRating != null
            ? Math.max(existing.rating, offering.rmpRating)
            : existing?.rating ?? offering.rmpRating,
        difficulty:
          existing?.difficulty != null && offering.rmpDifficulty != null
            ? Math.min(existing.difficulty, offering.rmpDifficulty)
            : existing?.difficulty ?? offering.rmpDifficulty,
        review_count: 0,
        tags: [...mergedTags],
        matched_confidence: Math.max(existing?.matched_confidence ?? 0, offering.matchConfidence),
        refreshed_at: snapshot.updatedAt,
      });
    }

    const departmentKey = `${schoolId}:${slugify(offering.department)}`;
    departmentBuckets.set(departmentKey, [
      ...(departmentBuckets.get(departmentKey) ?? []),
      offering,
    ]);

    const termSample = Math.max(
      Math.round(offering.sampleSize / Math.max(offering.trend.length, 1)),
      12,
    );
    for (const point of offering.trend) {
      const buckets = estimateGradeBuckets(termSample, point.avgGpa, point.aPct);
      gradeSeries.push({
        id: `grade:${offering.id}:${slugify(point.term)}`,
        school_id: schoolId,
        course_id: courseId,
        professor_id: professorId,
        summary_id: offering.id,
        term: point.term,
        sample_size: termSample,
        avg_gpa: point.avgGpa,
        source_label: offering.sourceLabels[0] ?? "Published aggregate",
        estimated: true,
        a_count: buckets.find((item) => item.grade === "A")?.count ?? 0,
        b_count: buckets.find((item) => item.grade === "B")?.count ?? 0,
        c_count: buckets.find((item) => item.grade === "C")?.count ?? 0,
        d_count: buckets.find((item) => item.grade === "D")?.count ?? 0,
        f_count: buckets.find((item) => item.grade === "F")?.count ?? 0,
        published_at: snapshot.updatedAt,
      });
      }
    }

    for (const professor of explicitProfessorDirectory) {
      const schoolId = schoolIdBySlug.get(professor.schoolSlug);
      if (!schoolId) continue;

      const professorId = `prof:${schoolId}:${professor.professorSlug}`;
      if (!professorsMap.has(professorId)) {
        professorsMap.set(professorId, {
          id: professorId,
          school_id: schoolId,
          slug: professor.professorSlug,
          name: professor.professorName,
          department: professor.departments[0] ?? null,
          title: professor.professorTitle || null,
        });
      }

      if (!schoolsWithExplicitSections.has(professor.schoolSlug)) {
        for (const code of professor.courseCodes) {
          const normalizedCode = code.trim().toUpperCase();
          if (courseIdBySchoolCode.has(`${schoolId}:${normalizedCode}`)) {
            continue;
          }
          const slug = slugify(code);
          const courseId = `course:${schoolId}:${slug}`;
          if (!coursesMap.has(courseId)) {
            coursesMap.set(courseId, {
              id: courseId,
              school_id: schoolId,
              slug,
              code,
              name: code,
              department: professor.departments[0] ?? null,
            });
            courseIdBySchoolCode.set(`${schoolId}:${normalizedCode}`, courseId);
          }
        }
      }

      if (isTrustedRmpIdentity(professor)) {
        const existing = rmpMap.get(professorId);
        rmpMap.set(professorId, {
          professor_id: professorId,
          school_id: schoolId,
          rmp_id: existing?.rmp_id ?? null,
          rating: existing?.rating ?? professor.rmpRating ?? null,
          difficulty: existing?.difficulty ?? professor.rmpDifficulty ?? null,
          review_count: Math.max(existing?.review_count ?? 0, professor.sampleSize),
          tags: [...new Set([...(existing?.tags ?? []), ...professor.tags])],
          matched_confidence: Math.max(existing?.matched_confidence ?? 0, 100),
          refreshed_at: snapshot.updatedAt,
        });
      }
    }

    for (const section of explicitSections) {
      const schoolId = schoolIdBySlug.get(section.schoolSlug);
      if (!schoolId) continue;

      const sectionProfessorSlug =
        section.professorSlug ??
        (section.professorName ? slugifyProfessorName(section.professorName) : null);
      const professorId = sectionProfessorSlug
        ? `prof:${schoolId}:${sectionProfessorSlug}`
        : null;
      if (professorId && section.professorName && !professorsMap.has(professorId)) {
        professorsMap.set(professorId, {
          id: professorId,
          school_id: schoolId,
          slug: sectionProfessorSlug!,
          name: section.professorName,
          department: null,
          title: null,
        });
      }

      const courseId = `course:${schoolId}:${section.courseSlug}`;
      if (!coursesMap.has(courseId)) {
        coursesMap.set(courseId, {
          id: courseId,
          school_id: schoolId,
          slug: section.courseSlug,
          code: section.courseCode,
          name: section.courseName,
          department: null,
        });
      }
      courseIdBySchoolCode.set(`${schoolId}:${section.courseCode.trim().toUpperCase()}`, courseId);

      sectionsMap.set(section.id, {
        id: section.id,
        school_id: schoolId,
        course_id: courseId,
        professor_id: professorId,
        term: section.term,
        source_key: section.sourceKey ?? "published_section",
        source_url: null,
        instructor_name_raw: section.professorName ?? "",
        match_status: professorId ? "matched" : "unmatched",
        sample_size: 0,
      });
    }

  const departmentAggregates: DbDepartmentAggregateRow[] = [...departmentBuckets.entries()].map(
    ([key, offerings]) => {
      const [schoolId, departmentSlug] = key.split(":");
      const weights = offerings.map((item) => Math.max(item.sampleSize, 1));
      const coverageTier = offerings.some((item) => item.coverageTier === "institutional_plus_rmp")
        ? "institutional_plus_rmp"
        : offerings.some((item) => item.coverageTier === "institutional_only")
          ? "institutional_only"
          : "rmp_only";

      return {
        id: `dept:${schoolId}:${departmentSlug}:last_3_academic_years`,
        school_id: schoolId,
        department_slug: departmentSlug,
        department_name: offerings[0]?.department ?? "General",
        metric_window: "last_3_academic_years",
        coverage_tier: coverageTier,
        avg_classify_score: round(weightedAverage(offerings.map((item) => item.classifyScore), weights) ?? 0, 1),
        avg_expected_gpa: round(weightedAverage(offerings.map((item) => item.expectedGpa), weights) ?? 0, 2),
        avg_a_rate: round(weightedAverage(offerings.map((item) => item.aRate), weights) ?? 0, 1),
        professor_count: new Set(offerings.map((item) => item.professorSlug)).size,
        course_count: new Set(offerings.map((item) => item.courseSlug)).size,
        sample_size: offerings.reduce((sum, item) => sum + item.sampleSize, 0),
        latest_freshness: offerings[0]?.freshness ?? snapshot.updatedAt,
        published_at: snapshot.updatedAt,
      };
    },
  );

  return {
    schools,
    professors: [...professorsMap.values()],
    courses: [...coursesMap.values()],
    sections: [...sectionsMap.values()],
    rmpRatings: [...rmpMap.values()],
    summaries,
    departmentAggregates,
    gradeSeries,
  };
}

function requireServiceRoleKey() {
  loadScriptEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for DB publishing.");
  return { url, serviceRoleKey };
}

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = requireServiceRoleKey();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function upsertRows<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: TableKey,
  rows: T[],
  onConflict: string,
) {
  if (!rows.length) return;
  for (const batch of chunk(rows)) {
    const { error } = await client.from(table).upsert(batch, {
      onConflict,
      ignoreDuplicates: false,
    });
    if (error) throw new Error(`Upsert failed for ${table}: ${error.message}`);
  }
}

function toLegacySchoolRows(rows: DbSchoolRow[]): LegacyDbSchoolRow[] {
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    short_name: row.short_name,
    aliases: row.aliases,
    city: row.city,
    state: row.state,
    kind: row.kind,
    coverage_tier: row.coverage_tier,
    source_primary: row.source_primary,
    source_fallback: row.source_fallback,
    source_note: row.source_note,
    planner_readiness: row.planner_readiness,
    has_catalog: row.has_catalog,
    has_sections: row.has_sections,
    has_instructor_directory: row.has_instructor_directory,
    has_planner: row.has_planner,
    has_official_grades: row.has_official_grades,
    has_rmp: row.has_rmp,
    has_community_evidence: row.has_community_evidence,
    evidence_freshness: row.evidence_freshness,
    source_availability: row.source_availability,
    refreshed_at: row.refreshed_at,
  }));
}

async function upsertSchoolRows(client: SupabaseClient, rows: DbSchoolRow[]) {
  try {
    await upsertRows(client, "schools", rows, "id");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!LEGACY_SCHOOL_SCHEMA_REGEX.test(message)) {
      throw error;
    }

    console.warn(
      "schools table is on the legacy schema; retrying publish without readiness completeness columns.",
    );
    await upsertRows(client, "schools", toLegacySchoolRows(rows), "id");
  }
}

async function getExistingIdsForSchools(
  client: SupabaseClient,
  table: TableKey,
  schoolIds: string[],
  idColumn: string,
) {
  if (!schoolIds.length) return [] as string[];
  const ids: string[] = [];
  for (const batch of chunk(schoolIds)) {
    let offset = 0;

    while (true) {
      const { data, error } = await client
        .from(table)
        .select(`${idColumn}, school_id`)
        .in("school_id", batch)
        .range(offset, offset + BATCH_SIZE - 1);
      if (error) throw new Error(`Failed reading existing ids for ${table}: ${error.message}`);

      const rows = (data ?? []) as unknown as Array<Record<string, string>>;
      for (const row of rows) {
        const id = row[idColumn];
        if (id) ids.push(id);
      }

      if (rows.length < BATCH_SIZE) {
        break;
      }
      offset += BATCH_SIZE;
    }
  }
  return ids;
}

async function deleteMissingRows(
  client: SupabaseClient,
  table: TableKey,
  schoolIds: string[],
  idColumn: string,
  desiredIds: string[],
) {
  if (!schoolIds.length) return 0;
  const existingIds = await getExistingIdsForSchools(client, table, schoolIds, idColumn);
  const desired = new Set(desiredIds);
  const obsolete = existingIds.filter((id) => !desired.has(id));
  for (const batch of chunk(obsolete)) {
    const { error } = await client.from(table).delete().in(idColumn, batch);
    if (error) throw new Error(`Failed deleting obsolete rows from ${table}: ${error.message}`);
  }
  return obsolete.length;
}

async function clearSectionMeetingsForSchools(client: SupabaseClient, schoolIds: string[]) {
  if (!schoolIds.length) return;
  for (const batch of chunk(schoolIds)) {
    const { error } = await client.from("section_meetings").delete().in("school_id", batch);
    if (error) throw new Error(`Failed clearing section_meetings: ${error.message}`);
  }
}

export type ValidationSummary = {
  required: {
    schools: number;
    professors: number;
    courses: number;
    summaries: number;
  };
  optional: {
    sections: number;
    rmpRatings: number;
    departmentAggregates: number;
    gradeSeries: number;
  };
  readiness: {
    directoryReady: number;
    catalogReady: number;
    scheduleReady: number;
    evidenceReady: number;
  };
};

export function validateSnapshot(snapshot: PublishedCatalogSnapshot, payload = buildPayload(snapshot)) {
  const summary: ValidationSummary = {
    required: {
      schools: payload.schools.length,
      professors: payload.professors.length,
      courses: payload.courses.length,
      summaries: payload.summaries.length,
    },
    optional: {
      sections: payload.sections.length,
      rmpRatings: payload.rmpRatings.length,
      departmentAggregates: payload.departmentAggregates.length,
      gradeSeries: payload.gradeSeries.length,
    },
    readiness: {
      directoryReady: payload.schools.filter((row) => row.planner_readiness === "directory_ready").length,
      catalogReady: payload.schools.filter((row) => row.planner_readiness === "catalog_ready").length,
      scheduleReady: payload.schools.filter((row) => row.planner_readiness === "schedule_ready").length,
      evidenceReady: payload.schools.filter((row) => row.planner_readiness === "evidence_ready").length,
    },
  };

  const failures: string[] = [];
  const malformedSchoolDisplayRows = snapshot.schools.filter((school) => {
    if (!school.shortName?.trim()) return true;
    return (
      school.shortName.length > 72 ||
      isMalformedSchoolAlias(school.shortName) ||
      ((school.aliases?.length ?? 0) > 1 && school.shortName === school.aliases?.join(" "))
    );
  });
  if (malformedSchoolDisplayRows.length) {
    console.warn(
      `Warning: malformed school shortName values detected for ${malformedSchoolDisplayRows
        .slice(0, 4)
        .map((school) => school.slug)
        .join(", ")}`,
    );
  }
  if (!summary.required.schools) failures.push("No schools in snapshot.");
  if (!summary.required.professors) failures.push("No professors in snapshot.");
  if (!summary.required.courses) failures.push("No courses in snapshot.");
  if (!summary.required.summaries) failures.push("No published professor-course summaries in snapshot.");

  const explicitProfessorDirectory = snapshot.professorDirectory ?? [];
  const explicitSections = snapshot.sections ?? [];
  const schoolsClaimingInstructorCoverage = snapshot.schools.filter(
    (school) => school.supportProfile?.hasInstructorDirectory,
  );
  const duplicateProfessorKeys = new Set<string>();
  const seenProfessorKeys = new Set<string>();
  for (const row of explicitProfessorDirectory) {
    const key = `${row.schoolSlug}:${row.professorSlug}`;
    if (seenProfessorKeys.has(key)) {
      duplicateProfessorKeys.add(key);
    }
    seenProfessorKeys.add(key);
  }

  if (duplicateProfessorKeys.size) {
    failures.push(
      `Duplicate professor identity rows detected for ${[...duplicateProfessorKeys].slice(0, 4).join(", ")}`,
    );
  }

  for (const school of schoolsClaimingInstructorCoverage) {
    const explicitCount = explicitProfessorDirectory.filter(
      (row) => row.schoolSlug === school.slug,
    ).length;
    const payloadCount = payload.professors.filter((row) => row.school_id === school.id).length;
    if (!explicitCount && !payloadCount) {
      failures.push(`School ${school.slug} claims instructor coverage but publishes zero professor identities.`);
    }
  }

  const schoolsWithInstructorNamedSections = new Set(
    explicitSections
      .filter((section) => section.professorName?.trim())
      .map((section) => section.schoolSlug),
  );
  for (const schoolSlug of schoolsWithInstructorNamedSections) {
    const schoolId = payload.schools.find((row) => row.slug === schoolSlug)?.id;
    if (!schoolId) continue;
    const professorCount = payload.professors.filter((row) => row.school_id === schoolId).length;
    if (!professorCount) {
      failures.push(`School ${schoolSlug} publishes instructor-named sections but zero professors.`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    summary,
  };
}

async function getCurrentCounts(client: SupabaseClient) {
  const tableNames = [
    "schools",
    "professors",
    "courses",
    "published_professor_course_summaries",
  ] as const;
  const counts = {} as Record<(typeof tableNames)[number], number>;
  for (const table of tableNames) {
    const { count, error } = await client.from(table).select("id", { count: "exact", head: true });
    if (error) throw new Error(`Failed reading count for ${table}: ${error.message}`);
    counts[table] = count ?? 0;
  }
  return counts;
}

export async function validateAgainstDb(
  client: SupabaseClient,
  payload: PublishPayload,
  options: {
    allowRegression?: boolean;
    requireExactCounts?: boolean;
  } = {},
) {
  const { allowRegression = false, requireExactCounts = false } = options;
  const counts = await getCurrentCounts(client);
  const failures: string[] = [];
  const checks: Array<[keyof typeof counts, number]> = [
    ["schools", payload.schools.length],
    ["professors", payload.professors.length],
    ["courses", payload.courses.length],
    ["published_professor_course_summaries", payload.summaries.length],
  ];

  for (const [table, nextCount] of checks) {
    const currentCount = counts[table] ?? 0;
    if (!allowRegression && currentCount > 0 && nextCount < Math.floor(currentCount * 0.5)) {
      failures.push(`${table} regressed too far: current=${currentCount}, next=${nextCount}`);
    }
    if (requireExactCounts && currentCount !== nextCount) {
      failures.push(`${table} count mismatch: current=${currentCount}, snapshot=${nextCount}`);
    }
  }

  return { ok: failures.length === 0, failures, currentCounts: counts };
}

function shouldRetrySupabaseWrite(error: unknown) {
  const message = String(error).toLowerCase();
  return (
    message.includes("521") ||
    message.includes("522") ||
    message.includes("523") ||
    message.includes("524") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("cloudflare") ||
    message.includes("web server is down") ||
    message.includes("fetch failed") ||
    message.includes("network")
  );
}

async function retrySupabaseWrite<T>(
  label: string,
  action: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetrySupabaseWrite(error)) {
        break;
      }

      const waitMs = attempt * 1_500;
      console.warn(`${label} failed on attempt ${attempt}; retrying in ${waitMs}ms.`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

type SupabaseMutationResult = {
  error: {
    message: string;
  } | null;
};

async function requireTableAccessible(
  client: SupabaseClient,
  table: string,
  select: string,
) {
  const { error } = await client.from(table).select(select).range(0, 0);
  if (error) {
    throw new Error(`Required publish-support table ${table} is unavailable: ${error.message}`);
  }
}

export async function validatePublishSupport(client: SupabaseClient) {
  const failures: string[] = [];

  for (const [table, select] of [
    ["raw_source_snapshots", "id"],
    ["published_catalog_control", "slot"],
    ["etl_job_runs", "id"],
  ] as const) {
    try {
      await requireTableAccessible(client, table, select);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export async function publishSnapshotToSupabase(
  client: SupabaseClient,
  snapshot: PublishedCatalogSnapshot,
  options?: { snapshotId?: string },
) {
  const materializedSnapshot = mergeDirectorySchools(snapshot);
  const payload = buildPayload(materializedSnapshot);
  const schoolIds = payload.schools.map((row) => row.id);
  const runId = options?.snapshotId ?? `published-catalog:${new Date().toISOString()}`;

  await upsertSchoolRows(client, payload.schools);
  await upsertRows(client, "professors", payload.professors, "id");
  await upsertRows(client, "courses", payload.courses, "id");
  await upsertRows(client, "sections", payload.sections, "id");
  await upsertRows(client, "rmp_ratings", payload.rmpRatings, "professor_id");
  await upsertRows(client, "published_professor_course_summaries", payload.summaries, "id");
  await upsertRows(client, "department_aggregates", payload.departmentAggregates, "id");
  await upsertRows(client, "published_grade_distribution_series", payload.gradeSeries, "id");

  await clearSectionMeetingsForSchools(client, schoolIds);

  const deleted = {
    sections: await deleteMissingRows(client, "sections", schoolIds, "id", payload.sections.map((row) => row.id)),
    rmp_ratings: await deleteMissingRows(client, "rmp_ratings", schoolIds, "professor_id", payload.rmpRatings.map((row) => row.professor_id)),
    published_professor_course_summaries: await deleteMissingRows(client, "published_professor_course_summaries", schoolIds, "id", payload.summaries.map((row) => row.id)),
    department_aggregates: await deleteMissingRows(client, "department_aggregates", schoolIds, "id", payload.departmentAggregates.map((row) => row.id)),
    published_grade_distribution_series: await deleteMissingRows(client, "published_grade_distribution_series", schoolIds, "id", payload.gradeSeries.map((row) => row.id)),
    courses: await deleteMissingRows(client, "courses", schoolIds, "id", payload.courses.map((row) => row.id)),
    professors: await deleteMissingRows(client, "professors", schoolIds, "id", payload.professors.map((row) => row.id)),
  };

  let snapshotArtifactMode: "full" | "compact" = "full";
  const saveSnapshotArtifact = async (
    artifact: PublishedCatalogSnapshot | ReturnType<typeof buildCompactPublishedSnapshotArtifact>,
  ) => {
    const snapshotResponse = await retrySupabaseWrite<SupabaseMutationResult>(
      "Saving published snapshot artifact",
      async () =>
        await client.from("raw_source_snapshots").upsert(
          {
            id: runId,
            school_id: null,
            source_key: "published_catalog_run",
            source_type: "json",
            fetched_at: materializedSnapshot.updatedAt,
            payload: artifact,
          },
          { onConflict: "id", ignoreDuplicates: false },
        ),
    );
    return snapshotResponse.error;
  };

  let snapshotError = await saveSnapshotArtifact(materializedSnapshot);
  if (snapshotError) {
    snapshotArtifactMode = "compact";
    const compactArtifact = buildCompactPublishedSnapshotArtifact(materializedSnapshot, payload);
    snapshotError = await saveSnapshotArtifact(compactArtifact);
  }
  if (snapshotError) throw new Error(`Failed saving published snapshot artifact: ${snapshotError.message}`);

  const controlResponse = await retrySupabaseWrite<SupabaseMutationResult>(
    "Updating published catalog control",
    async () =>
      await client.from("published_catalog_control").upsert(
        {
          slot: "primary",
          active_snapshot_id: runId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slot", ignoreDuplicates: false },
      ),
  );
  const controlError = controlResponse.error;
  if (controlError) throw new Error(`Failed updating published catalog control: ${controlError.message}`);

  const runLogResponse = await retrySupabaseWrite<SupabaseMutationResult>(
    "Logging publish run",
    async () =>
      await client.from("etl_job_runs").insert({
        id: `etl:${runId}`,
        source_key: "published_catalog_publish",
        school_id: null,
        status: "success",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        detail: {
          snapshot_id: runId,
          snapshot_artifact_mode: snapshotArtifactMode,
          published_at: materializedSnapshot.updatedAt,
          counts: {
            schools: payload.schools.length,
            professors: payload.professors.length,
            courses: payload.courses.length,
            summaries: payload.summaries.length,
          },
          deleted,
        },
      }),
  );
  const runLogError = runLogResponse.error;
  if (runLogError) throw new Error(`Failed logging publish run: ${runLogError.message}`);

  return {
    runId,
    deleted,
    summary: {
      schools: payload.schools.length,
      professors: payload.professors.length,
      courses: payload.courses.length,
      sections: payload.sections.length,
      rmpRatings: payload.rmpRatings.length,
      summaries: payload.summaries.length,
      departmentAggregates: payload.departmentAggregates.length,
      gradeSeries: payload.gradeSeries.length,
    },
  };
}

export async function readPublishedSnapshotArtifact(
  client: SupabaseClient,
  snapshotId: string,
): Promise<PublishedCatalogSnapshot> {
  const { data, error } = await client
    .from("raw_source_snapshots")
    .select("id, payload")
    .eq("id", snapshotId)
    .maybeSingle();

  if (error) throw new Error(`Failed reading snapshot ${snapshotId}: ${error.message}`);
  if (!data?.payload) throw new Error(`No published snapshot payload found for ${snapshotId}`);
  return data.payload as PublishedCatalogSnapshot;
}

export function isDirectScriptRun(metaUrl: string) {
  return process.argv[1] && pathToFileURL(process.argv[1]).href === metaUrl;
}
