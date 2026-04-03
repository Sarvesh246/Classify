export type CoverageTier =
  | "institutional_plus_rmp"
  | "institutional_only"
  | "rmp_only";

export type SearchHitType = "school" | "course" | "professor";

export type DataCompleteness =
  | "institutional_full"
  | "institutional_partial"
  | "rmp_only"
  | "directory_only";

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
  departmentDelta?: ProfessorDelta;
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
  professor: ProfessorCourseSummary;
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

export interface PublishedCatalogSnapshot {
  updatedAt: string;
  schools: School[];
  offerings: ProfessorCourseSummary[];
  departmentAggregates?: DepartmentAggregate[];
  gradeDistributionSeries?: GradeDistributionSeries[];
  sectionMeetings?: SectionMeeting[];
}

export interface SourceAdapter {
  key: string;
  label: string;
  sourceType: "json" | "csv" | "tableau" | "pdf" | "graphql";
  description?: string;
  fetchRaw(): Promise<unknown>;
  normalize(payload: unknown): Promise<unknown>;
}
