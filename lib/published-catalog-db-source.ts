import "server-only";

import { createClient } from "@supabase/supabase-js";
import type {
  CoverageTier,
  DataCompleteness,
  DepartmentAggregate,
  EvidenceSourceKind,
  GradeDistributionSeries,
  PlannerReadiness,
  ProfessorCourseSummary,
  PublishedCatalogSnapshot,
  School,
  SectionMeeting,
  TrendPoint,
} from "@/lib/types";
import { serverLog } from "@/lib/server-logger";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type DbSchoolRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  aliases: JsonValue | null;
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
  evidence_freshness: string | null;
  source_availability: JsonValue;
  catalog_completeness_pct: number | null;
  section_completeness_pct: number | null;
  meeting_time_completeness_pct: number | null;
  evidence_completeness_pct: number | null;
  readiness_reason: string | null;
  refreshed_at: string | null;
};

const SCHOOLS_SELECT_FULL =
  "id, slug, name, short_name, aliases, city, state, kind, coverage_tier, source_primary, source_fallback, source_note, planner_readiness, has_catalog, has_sections, has_instructor_directory, has_planner, has_official_grades, has_rmp, has_community_evidence, evidence_freshness, source_availability, catalog_completeness_pct, section_completeness_pct, meeting_time_completeness_pct, evidence_completeness_pct, readiness_reason, refreshed_at";

const SCHOOLS_SELECT_LEGACY =
  "id, slug, name, short_name, city, state, kind, coverage_tier, source_primary, source_fallback, source_note, planner_readiness, has_catalog, has_sections, has_instructor_directory, has_planner, has_official_grades, has_rmp, has_community_evidence, evidence_freshness, source_availability, refreshed_at";

type DbPublishedCatalogControlRow = {
  slot: string;
  active_snapshot_id: string;
  updated_at: string | null;
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
  confidence: number | null;
  match_confidence: number | null;
  freshness_label: string | null;
  source_labels: JsonValue;
  ranking_mode: ProfessorCourseSummary["rankingMode"] | null;
  available_evidence_sources: JsonValue;
  has_section_planning: boolean;
  data_completeness: DataCompleteness | null;
  latest_term: string | null;
  published_at: string | null;
};

type DbDepartmentAggregateRow = {
  school_id: string;
  department_slug: string;
  department_name: string;
  coverage_tier: CoverageTier;
  avg_classify_score: number | null;
  avg_expected_gpa: number | null;
  avg_a_rate: number | null;
  professor_count: number;
  course_count: number;
  sample_size: number;
  latest_freshness: string | null;
};

type DbGradeSeriesRow = {
  id: string;
  school_id: string;
  course_id: string;
  professor_id: string | null;
  summary_id: string | null;
  term: string;
  sample_size: number;
  avg_gpa: number | null;
  source_label: string | null;
  estimated: boolean;
  a_count: number;
  b_count: number;
  c_count: number;
  d_count: number;
  f_count: number;
};

type DbRmpRatingRow = {
  professor_id: string;
  rating: number | null;
  difficulty: number | null;
  tags: JsonValue;
};

type DbSectionRow = {
  id: string;
  school_id: string;
  course_id: string;
  professor_id: string | null;
  term: string;
  source_key: string;
  instructor_name_raw: string | null;
};

type DbSectionMeetingRow = {
  section_id: string;
  school_id: string;
  instructor_name: string | null;
  meeting_days: JsonValue;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  source_key: string;
};

type PublishedCatalogDbTableCheck = {
  table: string;
  select: string;
  required: boolean;
};

export type PublishedCatalogDbTableStatus = {
  table: string;
  required: boolean;
  ok: boolean;
  rowCount: number | null;
  error: string | null;
};

export type PublishedCatalogDbHealth = {
  configured: boolean;
  credentialKind: "service_role" | "publishable" | "missing";
  tables: PublishedCatalogDbTableStatus[];
  requiredTablesOk: boolean;
  missingRequiredTables: string[];
  missingOptionalTables: string[];
  activeSnapshotId?: string | null;
};

const DB_HEALTH_CACHE_TTL_MS = 15_000;

const PUBLISHED_CATALOG_DB_TABLES: PublishedCatalogDbTableCheck[] = [
  { table: "schools", select: "id", required: true },
  { table: "professors", select: "id", required: true },
  { table: "courses", select: "id", required: true },
  { table: "published_professor_course_summaries", select: "id", required: true },
  { table: "sections", select: "id", required: false },
  { table: "rmp_ratings", select: "professor_id", required: false },
  { table: "department_aggregates", select: "id", required: false },
  { table: "published_grade_distribution_series", select: "id", required: false },
  { table: "section_meetings", select: "id", required: false },
];

let dbHealthCache:
  | {
      expiresAt: number;
      value: PublishedCatalogDbHealth;
    }
  | null = null;

function arrayOfStrings(value: JsonValue, allowed?: readonly string[]) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  if (!allowed) {
    return items;
  }

  return items.filter((item): item is string => allowed.includes(item));
}

function formatFreshness(value: string | null, fallbackTimestamp: string | null) {
  if (value?.trim()) {
    return value.trim();
  }
  if (fallbackTimestamp) {
    return `Updated ${fallbackTimestamp.slice(0, 10)}`;
  }
  return "Published DB snapshot";
}

function buildSchoolFromRow(row: DbSchoolRow): School {
  const hasCatalog = row.has_catalog;
  const hasSections = row.has_sections;
  const hasOfficialGrades = row.has_official_grades;
  const hasRmp = row.has_rmp;
  const hasCommunityEvidence = row.has_community_evidence;
  const derivedCatalogCompletenessPct = row.catalog_completeness_pct ?? (hasCatalog ? 100 : 0);
  const derivedSectionCompletenessPct = row.section_completeness_pct ?? (hasSections ? 100 : 0);
  const derivedMeetingTimeCompletenessPct =
    row.meeting_time_completeness_pct ?? (hasSections ? 100 : 0);
  const derivedEvidenceCompletenessPct =
    row.evidence_completeness_pct ??
    ((hasOfficialGrades || hasRmp || hasCommunityEvidence) ? 100 : 0);
  const derivedPlannerReadiness =
    row.planner_readiness ??
    (hasSections && derivedEvidenceCompletenessPct >= 60
      ? "evidence_ready"
      : hasSections
        ? "schedule_ready"
        : hasCatalog
          ? "catalog_ready"
          : "directory_ready");
  const derivedReadinessReason =
    row.readiness_reason ??
    (derivedPlannerReadiness === "evidence_ready"
      ? "Sections and evidence-backed ranking signals are published."
      : derivedPlannerReadiness === "schedule_ready"
        ? "Sections are published, but ranking evidence is still partial."
        : derivedPlannerReadiness === "catalog_ready"
          ? "Courses and instructors are published, but section timing is still incomplete."
          : "Only school-directory coverage is published so far.");

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    city: row.city,
    state: row.state,
    kind: row.kind.toLowerCase().includes("private") ? "Private" : "Public",
    coverageTier: row.coverage_tier,
    aliases: arrayOfStrings(row.aliases),
    directoryCount: 0,
    sourceStatus: {
      primary: row.source_primary,
      fallback: row.source_fallback,
      freshness: formatFreshness(row.evidence_freshness, row.refreshed_at),
      note: row.source_note,
    },
    supportProfile: {
      plannerReadiness: derivedPlannerReadiness,
      hasCatalog,
      hasSections,
      hasInstructorDirectory: row.has_instructor_directory,
      hasPlanner: row.has_planner,
      hasOfficialGrades,
      hasRmp,
      hasCommunityEvidence,
      evidenceFreshness: formatFreshness(row.evidence_freshness, row.refreshed_at),
      sourceAvailability: arrayOfStrings(row.source_availability, [
        "official_grades",
        "schedule",
        "catalog",
        "rmp",
        "community",
        "syllabus",
      ]) as EvidenceSourceKind[],
      catalogCompletenessPct: derivedCatalogCompletenessPct,
      sectionCompletenessPct: derivedSectionCompletenessPct,
      meetingTimeCompletenessPct: derivedMeetingTimeCompletenessPct,
      evidenceCompletenessPct: derivedEvidenceCompletenessPct,
      readinessReason: derivedReadinessReason,
    },
    descriptor:
      "Universal school profile with the same Classify planning workflow. Course and schedule depth expands as school data is published.",
    programs: [],
  };
}

function buildGradeBuckets(row: DbGradeSeriesRow) {
  return [
    { grade: "A", count: row.a_count, pct: row.sample_size ? (row.a_count / row.sample_size) * 100 : 0 },
    { grade: "B", count: row.b_count, pct: row.sample_size ? (row.b_count / row.sample_size) * 100 : 0 },
    { grade: "C", count: row.c_count, pct: row.sample_size ? (row.c_count / row.sample_size) * 100 : 0 },
    { grade: "D", count: row.d_count, pct: row.sample_size ? (row.d_count / row.sample_size) * 100 : 0 },
    { grade: "F", count: row.f_count, pct: row.sample_size ? (row.f_count / row.sample_size) * 100 : 0 },
  ] as GradeDistributionSeries["buckets"];
}

function buildSummaryCopy(courseCode: string, courseName: string, professorName: string) {
  return {
    summary: `${professorName} teaching ${courseCode} ${courseName}`.trim(),
    professorSummary: `Published evidence for ${professorName} in this course set.`,
    courseSummary: `Compare published instructor outcomes for ${courseCode} ${courseName}.`.trim(),
  };
}

function describeError(error: unknown) {
  if (error && typeof error === "object") {
    const message =
      "message" in error && typeof error.message === "string"
        ? error.message
        : JSON.stringify(error);
    return message || String(error);
  }

  return String(error);
}

type RangeResult<T extends Record<string, unknown>> = PromiseLike<{
  data: T[] | null;
  error: { message?: string } | null;
}>;

type SupabaseRangeClient<T extends Record<string, unknown>> = {
  from(table: string): {
    select(query: string): {
      range(from: number, to: number): RangeResult<T>;
    };
  };
};

async function selectAll<T extends Record<string, unknown>>(
  client: SupabaseRangeClient<T>,
  table: string,
  select: string,
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client.from(table).select(select).range(from, from + pageSize - 1);
    if (error) {
      throw error;
    }

    const batch = (data ?? []) as T[];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return rows;
}

/** Non-core tables: missing relation or empty is OK until migration/publish completes. */
async function selectAllOrEmpty<T extends Record<string, unknown>>(
  client: SupabaseRangeClient<T>,
  table: string,
  select: string,
): Promise<T[]> {
  try {
    return await selectAll<T>(client, table, select);
  } catch (err) {
    serverLog.warn("published_catalog_db_table_unavailable", {
      table,
      error: describeError(err),
    });
    return [];
  }
}

async function selectAllSchools(
  client: SupabaseRangeClient<DbSchoolRow>,
): Promise<DbSchoolRow[]> {
  try {
    return await selectAll<DbSchoolRow>(client, "schools", SCHOOLS_SELECT_FULL);
  } catch (err) {
    const error = describeError(err);
    if (!/aliases|catalog_completeness_pct|section_completeness_pct|meeting_time_completeness_pct|evidence_completeness_pct|readiness_reason/i.test(error)) {
      throw err;
    }

    serverLog.warn("published_catalog_db_school_schema_legacy", {
      error,
    });

    return selectAll<DbSchoolRow>(client, "schools", SCHOOLS_SELECT_LEGACY);
  }
}

export function hasPublishedCatalogDbConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

function createPublishedCatalogClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function probeTable(
  client: ReturnType<typeof createPublishedCatalogClient>,
  tableCheck: PublishedCatalogDbTableCheck,
): Promise<PublishedCatalogDbTableStatus> {
  if (!client) {
    return {
      table: tableCheck.table,
      required: tableCheck.required,
      ok: false,
      rowCount: null,
      error: "Supabase client not configured",
    };
  }

  const { count, data, error } = await client
    .from(tableCheck.table)
    .select(tableCheck.select, { count: "exact" })
    .range(0, 0);

  if (error) {
    return {
      table: tableCheck.table,
      required: tableCheck.required,
      ok: false,
      rowCount: null,
      error: describeError(error),
    };
  }

  return {
    table: tableCheck.table,
    required: tableCheck.required,
    ok: true,
    rowCount: count ?? (Array.isArray(data) ? data.length : 0),
    error: null,
  };
}

export async function getPublishedCatalogDbHealth(): Promise<PublishedCatalogDbHealth> {
  if (dbHealthCache && dbHealthCache.expiresAt > Date.now()) {
    return dbHealthCache.value;
  }

  const client = createPublishedCatalogClient();
  const credentialKind: PublishedCatalogDbHealth["credentialKind"] =
    process.env.SUPABASE_SERVICE_ROLE_KEY
      ? "service_role"
      : (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        ? "publishable"
        : "missing";

  if (!client) {
    const missingStatuses = PUBLISHED_CATALOG_DB_TABLES.map((tableCheck) => ({
      table: tableCheck.table,
      required: tableCheck.required,
      ok: false,
      rowCount: null,
      error: "Supabase URL or key missing",
    }));

    const health: PublishedCatalogDbHealth = {
      configured: false,
      credentialKind,
      tables: missingStatuses,
      requiredTablesOk: false,
      missingRequiredTables: missingStatuses
        .filter((status) => status.required)
        .map((status) => status.table),
      missingOptionalTables: missingStatuses
        .filter((status) => !status.required)
        .map((status) => status.table),
      activeSnapshotId: null,
    };

    dbHealthCache = {
      expiresAt: Date.now() + DB_HEALTH_CACHE_TTL_MS,
      value: health,
    };

    return health;
  }

  const tables = await Promise.all(
    PUBLISHED_CATALOG_DB_TABLES.map((tableCheck) => probeTable(client, tableCheck)),
  );
  const { data: controlRows, error: controlError } = await client
    .from("published_catalog_control")
    .select("slot, active_snapshot_id, updated_at")
    .eq("slot", "primary")
    .range(0, 0);

  const health: PublishedCatalogDbHealth = {
    configured: true,
    credentialKind,
    tables,
    requiredTablesOk: tables.filter((status) => status.required).every((status) => status.ok),
    missingRequiredTables: tables
      .filter((status) => status.required && !status.ok)
      .map((status) => status.table),
    missingOptionalTables: tables
      .filter((status) => !status.required && !status.ok)
      .map((status) => status.table),
    activeSnapshotId:
      controlError || !Array.isArray(controlRows)
        ? null
        : ((controlRows[0] as DbPublishedCatalogControlRow | undefined)?.active_snapshot_id ?? null),
  };

  dbHealthCache = {
    expiresAt: Date.now() + DB_HEALTH_CACHE_TTL_MS,
    value: health,
  };

  return health;
}

export async function readPublishedCatalogSnapshotFromDb(): Promise<PublishedCatalogSnapshot | null> {
  const client = createPublishedCatalogClient();
  if (!client) {
    return null;
  }

  try {
    const health = await getPublishedCatalogDbHealth();
    if (!health.requiredTablesOk) {
      serverLog.warn("published_catalog_db_required_tables_unavailable", {
        credentialKind: health.credentialKind,
        missingRequiredTables: health.missingRequiredTables,
        missingOptionalTables: health.missingOptionalTables,
      });
      return null;
    }

    const [
      schools,
      professors,
      courses,
      summaries,
      departments,
      gradeSeries,
      rmpRatings,
      sections,
      sectionMeetings,
    ] = await Promise.all([
      selectAllSchools(client),
      selectAll<DbProfessorRow>(
        client,
        "professors",
        "id, school_id, slug, name, department, title",
      ),
      selectAll<DbCourseRow>(
        client,
        "courses",
        "id, school_id, slug, code, name, department",
      ),
      selectAll<DbSummaryRow>(
        client,
        "published_professor_course_summaries",
        "id, school_id, course_id, professor_id, coverage_tier, classify_score, expected_gpa, a_rate, trend_delta, confidence, match_confidence, freshness_label, source_labels, ranking_mode, available_evidence_sources, has_section_planning, data_completeness, latest_term, published_at",
      ),
      selectAllOrEmpty<DbDepartmentAggregateRow>(
        client,
        "department_aggregates",
        "school_id, department_slug, department_name, coverage_tier, avg_classify_score, avg_expected_gpa, avg_a_rate, professor_count, course_count, sample_size, latest_freshness",
      ),
      selectAllOrEmpty<DbGradeSeriesRow>(
        client,
        "published_grade_distribution_series",
        "id, school_id, course_id, professor_id, summary_id, term, sample_size, avg_gpa, source_label, estimated, a_count, b_count, c_count, d_count, f_count",
      ),
      selectAllOrEmpty<DbRmpRatingRow>(
        client,
        "rmp_ratings",
        "professor_id, rating, difficulty, tags",
      ),
      selectAllOrEmpty<DbSectionRow>(
        client,
        "sections",
        "id, school_id, course_id, professor_id, term, source_key, instructor_name_raw",
      ),
      selectAllOrEmpty<DbSectionMeetingRow>(
        client,
        "section_meetings",
        "section_id, school_id, instructor_name, meeting_days, start_time, end_time, location, source_key",
      ),
    ]);

    if (!schools.length) {
      serverLog.warn("published_catalog_db_empty", {
        reason: "no_schools",
      });
      return null;
    }

    const schoolById = new Map(schools.map((row) => [row.id, buildSchoolFromRow(row)]));
    const courseById = new Map(courses.map((row) => [row.id, row]));
    const professorById = new Map(professors.map((row) => [row.id, row]));
    const rmpByProfessorId = new Map(rmpRatings.map((row) => [row.professor_id, row]));
    const sectionById = new Map(sections.map((row) => [row.id, row]));

    const trendBySummaryId = new Map<string, TrendPoint[]>();
    for (const row of gradeSeries) {
      const key = row.summary_id ?? `${row.school_id}:${row.course_id}:${row.professor_id ?? "course"}`;
      const point: TrendPoint = {
        term: row.term,
        avgGpa: row.avg_gpa,
        aPct: row.sample_size ? (row.a_count / row.sample_size) * 100 : null,
        rmpRating: null,
        rmpDifficulty: null,
        classifyScore: null,
      };
      trendBySummaryId.set(key, [...(trendBySummaryId.get(key) ?? []), point]);
    }

    const offerings: ProfessorCourseSummary[] = summaries.flatMap((row) => {
      const school = schoolById.get(row.school_id);
      const course = courseById.get(row.course_id);
      const professor = professorById.get(row.professor_id);
      if (!school || !course || !professor) {
        return [];
      }

      const rmp = rmpByProfessorId.get(row.professor_id);
      const trend = trendBySummaryId.get(row.id) ?? [];
      const sampleSize = trend.reduce((sum, point) => {
        const gradeRow = gradeSeries.find(
          (item) =>
            (item.summary_id ?? `${item.school_id}:${item.course_id}:${item.professor_id ?? "course"}`) === row.id &&
            item.term === point.term,
        );
        return sum + (gradeRow?.sample_size ?? 0);
      }, 0);
      const copy = buildSummaryCopy(course.code, course.name, professor.name);

      return [{
        id: row.id,
        schoolSlug: school.slug,
        schoolName: school.name,
        professorSlug: professor.slug,
        courseSlug: course.slug,
        courseCode: course.code,
        courseName: course.name,
        professorName: professor.name,
        department: course.department ?? professor.department ?? "General",
        classifyScore: row.classify_score,
        expectedGpa: row.expected_gpa,
        aRate: row.a_rate,
        rmpRating: rmp?.rating ?? null,
        rmpDifficulty: rmp?.difficulty ?? null,
        trendDelta: row.trend_delta,
        confidence: row.confidence ?? 0,
        sampleSize,
        coverageTier: row.coverage_tier,
        latestTerm: row.latest_term ?? (trend.at(-1)?.term ?? "Unknown"),
        termCount: trend.length,
        matchConfidence: row.match_confidence ?? row.confidence ?? 0,
        tags: arrayOfStrings(rmp?.tags ?? []),
        summary: copy.summary,
        professorTitle: professor.title ?? professor.department ?? "Instructor",
        professorSummary: copy.professorSummary,
        courseSummary: copy.courseSummary,
        freshness: row.freshness_label ?? formatFreshness(null, row.published_at),
        sourceLabels: arrayOfStrings(row.source_labels),
        dataCompleteness: row.data_completeness ?? "directory_only",
        trend,
        rankingMode: row.ranking_mode ?? undefined,
      }];
    });

    const dbSectionMeetings: SectionMeeting[] = sectionMeetings.flatMap((row) => {
      const section = sectionById.get(row.section_id);
      if (!section) {
        return [];
      }
      const school = schoolById.get(section.school_id);
      const course = courseById.get(section.course_id);
      if (!school || !course) {
        return [];
      }

      return [{
        sectionId: row.section_id,
        schoolSlug: school.slug,
        courseSlug: course.slug,
        term: section.term,
        days: arrayOfStrings(row.meeting_days),
        startTime: row.start_time,
        endTime: row.end_time,
        location: row.location,
        instructorName: row.instructor_name ?? section.instructor_name_raw,
        sourceKey: row.source_key,
      }];
    });

    const dbDepartmentAggregates: DepartmentAggregate[] = departments.flatMap((row) => {
      const school = schoolById.get(row.school_id);
      if (!school) {
        return [];
      }
      return [{
        schoolSlug: school.slug,
        schoolName: school.name,
        department: row.department_name,
        departmentSlug: row.department_slug,
        professorCount: row.professor_count,
        courseCount: row.course_count,
        coverageTier: row.coverage_tier,
        avgClassifyScore: row.avg_classify_score,
        avgExpectedGpa: row.avg_expected_gpa,
        avgARate: row.avg_a_rate,
        sampleSize: row.sample_size,
        latestFreshness: row.latest_freshness ?? school.sourceStatus.freshness,
        topProfessorName: "Unavailable",
      }];
    });

    const dbGradeSeries: GradeDistributionSeries[] = gradeSeries.flatMap((row) => {
      const school = schoolById.get(row.school_id);
      const course = courseById.get(row.course_id);
      if (!school || !course) {
        return [];
      }
      const professor = row.professor_id ? professorById.get(row.professor_id) : null;
      return [{
        id: row.id,
        offeringId:
          row.summary_id ??
          `${school.slug}:${course.slug}:${professor?.slug ?? "course"}`,
        schoolSlug: school.slug,
        courseSlug: course.slug,
        professorSlug: professor?.slug ?? "course-aggregate",
        term: row.term,
        sampleSize: row.sample_size,
        avgGpa: row.avg_gpa,
        sourceLabel: row.source_label ?? "Published aggregate",
        estimated: row.estimated,
        buckets: buildGradeBuckets(row),
      }];
    });

    const updatedAt =
      schools
        .map((row) => row.refreshed_at)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ??
      new Date().toISOString();

    return {
      updatedAt,
      schools: [...schoolById.values()],
      offerings,
      departmentAggregates: dbDepartmentAggregates,
      gradeDistributionSeries: dbGradeSeries,
      sectionMeetings: dbSectionMeetings,
      publishMetadata: {
        runId: health.activeSnapshotId ?? "db-active-run-unavailable",
        activatedAt: updatedAt,
        source: "db",
        summary: {
          schoolCount: schoolById.size,
          offeringCount: offerings.length,
          sectionCount: dbSectionMeetings.length,
          evidenceReadySchoolCount: [...schoolById.values()].filter(
            (item) => item.supportProfile?.plannerReadiness === "evidence_ready",
          ).length,
        },
      },
    };
  } catch (err) {
    serverLog.warn("published_catalog_db_read_failed", {
      error: describeError(err),
    });
    return null;
  }
}
