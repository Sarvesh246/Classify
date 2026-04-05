import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { estimateGradeBuckets } from "../lib/grade-distribution-estimate";

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
  professor_id: string;
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
const BATCH_SIZE = 500;
const LEGACY_SCHOOL_SCHEMA_REGEX =
  /catalog_completeness_pct|section_completeness_pct|meeting_time_completeness_pct|evidence_completeness_pct|readiness_reason/i;

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

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clampPct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
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

function deriveSchoolSupport(school: SchoolRecord, offerings: OfferingRecord[]) {
  const hasCatalog = offerings.length > 0;
  const hasSections = offerings.some((item) => item.hasSectionPlanning);
  const hasOfficial = offerings.some(hasOfficialGrades);
  const hasRmpEvidence = offerings.some(hasRmp);
  const uniqueCourses = new Set(offerings.map((item) => item.courseSlug)).size;
  const sectionCourses = new Set(
    offerings.filter((item) => item.hasSectionPlanning).map((item) => item.courseSlug),
  ).size;
  const catalogCompletenessPct = hasCatalog ? 100 : 0;
  const sectionCompletenessPct = hasCatalog
    ? clampPct((sectionCourses / Math.max(uniqueCourses, 1)) * 100)
    : 0;
  const meetingTimeCompletenessPct = hasSections
    ? clampPct((offerings.filter((item) => item.hasSectionPlanning).length / Math.max(offerings.length, 1)) * 100)
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
    hasInstructorDirectory: hasCatalog,
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
  const offeringsBySchool = new Map<string, OfferingRecord[]>();
  for (const offering of snapshot.offerings) {
    offeringsBySchool.set(offering.schoolSlug, [
      ...(offeringsBySchool.get(offering.schoolSlug) ?? []),
      offering,
    ]);
  }

  const schoolIdBySlug = new Map(snapshot.schools.map((school) => [school.slug, school.id]));
  const schools: DbSchoolRow[] = snapshot.schools.map((school) => {
    const offerings = offeringsBySchool.get(school.slug) ?? [];
    const support = deriveSchoolSupport(school, offerings);
    return {
      id: school.id,
      slug: school.slug,
      name: school.name,
      short_name: school.shortName,
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

    const sectionId = `section:${offering.id}`;
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
    const { data, error } = await client.from(table).select(`${idColumn}, school_id`).in("school_id", batch);
    if (error) throw new Error(`Failed reading existing ids for ${table}: ${error.message}`);
    for (const row of ((data ?? []) as unknown as Array<Record<string, string>>)) {
      const id = row[idColumn];
      if (id) ids.push(id);
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
  if (!summary.required.schools) failures.push("No schools in snapshot.");
  if (!summary.required.professors) failures.push("No professors in snapshot.");
  if (!summary.required.courses) failures.push("No courses in snapshot.");
  if (!summary.required.summaries) failures.push("No published professor-course summaries in snapshot.");

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
  allowRegression = false,
) {
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
  }

  return { ok: failures.length === 0, failures, currentCounts: counts };
}

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
  const payload = buildPayload(snapshot);
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
  };

  const { error: snapshotError } = await client.from("raw_source_snapshots").upsert({
    id: runId,
    school_id: null,
    source_key: "published_catalog_run",
    source_type: "json",
    fetched_at: snapshot.updatedAt,
    payload: snapshot,
  }, { onConflict: "id", ignoreDuplicates: false });
  if (snapshotError) throw new Error(`Failed saving published snapshot artifact: ${snapshotError.message}`);

  const { error: controlError } = await client.from("published_catalog_control").upsert({
    slot: "primary",
    active_snapshot_id: runId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "slot", ignoreDuplicates: false });
  if (controlError) throw new Error(`Failed updating published catalog control: ${controlError.message}`);

  const { error: runLogError } = await client.from("etl_job_runs").insert({
    id: `etl:${runId}`,
    source_key: "published_catalog_publish",
    school_id: null,
    status: "success",
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    detail: {
      snapshot_id: runId,
      published_at: snapshot.updatedAt,
      counts: {
        schools: payload.schools.length,
        professors: payload.professors.length,
        courses: payload.courses.length,
        summaries: payload.summaries.length,
      },
      deleted,
    },
  });
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
