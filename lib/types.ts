export type CoverageTier =
  | "institutional_plus_rmp"
  | "institutional_only"
  | "rmp_only";

export type SearchHitType = "school" | "course" | "professor";

export type PlannerReadiness =
  | "evidence_ready"
  | "schedule_ready"
  | "catalog_ready"
  | "directory_ready";

export type EvidenceSourceKind =
  | "official_grades"
  | "schedule"
  | "catalog"
  | "rmp"
  | "community"
  | "syllabus";

export type ConfidenceLabel = "high" | "medium" | "low";

export type RankingMode =
  | "expected_gpa"
  | "ease_score"
  | "planner_fit";

export type DataCompleteness =
  | "institutional_full"
  | "institutional_partial"
  | "rmp_only"
  | "directory_only";

export type ProfessorCoverageLevel =
  | "directory_only"
  | "instructor_directory_ready"
  | "stats_partial"
  | "stats_full";

export type ProfessorStatsAvailability =
  | "none"
  | "rmp_only"
  | "partial"
  | "full";

export interface SchoolSupportProfile {
  plannerReadiness: PlannerReadiness;
  hasCatalog: boolean;
  hasSections: boolean;
  hasInstructorDirectory: boolean;
  professorCoverageLevel?: ProfessorCoverageLevel;
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
}

export interface EvidenceProfile {
  sourceKinds: EvidenceSourceKind[];
  confidenceLabel: ConfidenceLabel;
  hasOfficialGrades: boolean;
  hasScheduleData: boolean;
  hasRmp: boolean;
  hasCommunityEvidence: boolean;
  hasSyllabusEvidence: boolean;
}

export interface SearchHitContext {
  schoolSlug: string;
  schoolShortName: string;
  contextLabel: string;
  searchScope: "directory" | "course" | "professor_course";
}

export interface SearchHit {
  type: SearchHitType;
  id: string;
  label: string;
  school: string;
  slug: string;
  href: string;
  coverageTier: CoverageTier;
  highlight: string;
  secondaryMetrics: string[];
  freshness: string;
  sourceLabels: string[];
  dataCompleteness: DataCompleteness;
  context: SearchHitContext;
  supportProfile?: SchoolSupportProfile;
  /** Short labels explaining match quality (search ranking). */
  rankHints?: string[];
}

export interface TrendPoint {
  term: string;
  avgGpa: number | null;
  aPct: number | null;
  rmpRating: number | null;
  rmpDifficulty: number | null;
  classifyScore: number | null;
}

export interface ProfessorDelta {
  department: string;
  baselineLabel: string;
  classifyScoreDelta: number | null;
  expectedGpaDelta: number | null;
  aRateDelta: number | null;
}

export interface ProfessorCourseSummary {
  id: string;
  schoolSlug: string;
  schoolName: string;
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
  evidenceProfile?: EvidenceProfile;
  hasSectionPlanning?: boolean;
  departmentDelta?: ProfessorDelta;
}

export interface ProfessorDirectoryRow {
  id: string;
  schoolSlug: string;
  schoolName: string;
  professorSlug: string;
  professorName: string;
  professorTitle: string;
  departments: string[];
  coursePrefixes: string[];
  courseCodes: string[];
  courseCount: number;
  sectionCount: number;
  coverageTier: CoverageTier;
  coverageLevel: ProfessorCoverageLevel;
  statsAvailability: ProfessorStatsAvailability;
  evidenceFreshness: string;
  sourceKinds: EvidenceSourceKind[];
  hasInstitutionalStats: boolean;
  hasRmp: boolean;
  hasSchedulePresence: boolean;
  expectedGpa: number | null;
  aRate: number | null;
  classifyScore: number | null;
  rmpRating: number | null;
  rmpDifficulty: number | null;
  sampleSize: number;
  trend: TrendPoint[];
  tags: string[];
  summary: string;
}

export interface School {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
  kind: "Public" | "Private";
  coverageTier: CoverageTier;
  aliases: string[];
  directoryCount: number;
  sourceStatus: {
    primary: string;
    fallback: string;
    freshness: string;
    note: string;
  };
  supportProfile?: SchoolSupportProfile;
  descriptor: string;
  programs: string[];
}

export interface CourseGroup {
  schoolSlug: string;
  courseSlug: string;
  courseCode: string;
  courseName: string;
  department: string;
  summary: string;
  coverageTier: CoverageTier;
  offeringCount: number;
  topClassifyScore: number | null;
  topExpectedGpa: number | null;
  topProfessorName: string;
  freshness: string;
}

export interface ProfessorProfile {
  school: School;
  offerings: ProfessorCourseSummary[];
  professor: ProfessorDirectoryRow;
}

export interface ScoreBreakdownRow {
  key: "avgGpa" | "aPct" | "rmpEase" | "rmpQuality";
  label: string;
  value: number | null;
  normalized: number | null;
  baseWeight: number;
  effectiveWeight: number;
  contribution: number | null;
}

export interface GradeDistributionBucket {
  grade: "A" | "B" | "C" | "D" | "F";
  count: number;
  pct: number;
}

export interface GradeDistributionSeries {
  id: string;
  offeringId: string;
  schoolSlug: string;
  courseSlug: string;
  professorSlug: string;
  term: string;
  sampleSize: number;
  avgGpa: number | null;
  sourceLabel: string;
  estimated: boolean;
  buckets: GradeDistributionBucket[];
}

export interface DepartmentAggregate {
  schoolSlug: string;
  schoolName: string;
  department: string;
  departmentSlug: string;
  professorCount: number;
  courseCount: number;
  coverageTier: CoverageTier;
  avgClassifyScore: number | null;
  avgExpectedGpa: number | null;
  avgARate: number | null;
  sampleSize: number;
  latestFreshness: string;
  topProfessorName: string;
}

export interface SectionMeeting {
  sectionId: string;
  schoolSlug: string;
  courseSlug: string;
  term: string;
  days: string[];
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  instructorName: string | null;
  sourceKey: string;
}

export interface CatalogRecord {
  id: string;
  schoolSlug: string;
  courseSlug: string;
  courseCode: string;
  courseName: string;
  department: string;
  summary: string;
}

export interface SectionRecord {
  id: string;
  schoolSlug: string;
  courseSlug: string;
  courseCode: string;
  courseName: string;
  professorSlug: string | null;
  professorName: string | null;
  term: string;
  days: string[];
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  hasMeetingTime: boolean;
  sourceKey: string;
  rankingMode: RankingMode;
  evidenceProfile: EvidenceProfile;
  supportingOfferingId?: string;
}

export interface PublishedPlannerSchoolSnapshot {
  school: School;
  supportProfile: SchoolSupportProfile;
  updatedAt: string;
  catalog: CatalogRecord[];
  sections: SectionRecord[];
  instructorCount: number;
  courseCount: number;
}

export interface PlannerSnapshotResponse {
  school: School;
  supportProfile: SchoolSupportProfile;
  updatedAt: string;
  courseCount: number;
  instructorCount: number;
  catalogPreview: CatalogRecord[];
  sectionPreviewCount: number;
}

export interface PlannerSectionSliceResponse {
  school: School;
  supportProfile: SchoolSupportProfile;
  updatedAt: string;
  courseSlugs: string[];
  sections: SectionRecord[];
  sectionCount: number;
}

export interface PlannerSolveSelection {
  courseSlug: string;
  section: SectionRecord | null;
}

export interface PlannerSolveResponse {
  school: School;
  supportProfile: SchoolSupportProfile;
  rankingMode: RankingMode;
  selections: PlannerSolveSelection[];
  warnings: string[];
  updatedAt: string;
}

export interface PlannerDraft {
  id: string;
  name: string;
  school_slug: string;
  term_label: string | null;
  course_slugs: string[];
  ranking_mode: RankingMode;
  updated_at: string;
  created_at: string;
}

export interface PublishedCatalogSnapshot {
  updatedAt: string;
  schools: School[];
  offerings: ProfessorCourseSummary[];
  professorDirectory?: ProfessorDirectoryRow[];
  departmentAggregates?: DepartmentAggregate[];
  gradeDistributionSeries?: GradeDistributionSeries[];
  sectionMeetings?: SectionMeeting[];
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
}

export interface SourceAdapter {
  key: string;
  label: string;
  sourceType: "json" | "csv" | "tableau" | "pdf" | "graphql";
  description?: string;
  fetchRaw(): Promise<unknown>;
  normalize(payload: unknown): Promise<unknown>;
}
