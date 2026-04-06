import "server-only";

import {
  getCatalogOfferingsForSchool,
  getCatalogSchoolBySlug,
  getCatalogSectionMeetingsForSchool,
  getCatalogUpdatedAt,
  getCourseGroupsForSchool,
} from "@/lib/catalog";
import { getDirectorySchoolBySlug } from "@/lib/server-directory";
import type {
  CatalogRecord,
  ConfidenceLabel,
  EvidenceProfile,
  PlannerSectionSliceResponse,
  PlannerSnapshotResponse,
  PlannerSolveResponse,
  ProfessorCourseSummary,
  PublishedPlannerSchoolSnapshot,
  RankingMode,
  School,
  SchoolSupportProfile,
  SectionMeeting,
  SectionRecord,
} from "@/lib/types";

type PlannerSnapshotOptions = {
  includeCatalog?: boolean;
  includeSections?: boolean;
  catalogLimit?: number;
  courseSlugs?: string[];
};

function toConfidenceLabel(confidence: number): ConfidenceLabel {
  if (confidence >= 75) {
    return "high";
  }
  if (confidence >= 50) {
    return "medium";
  }
  return "low";
}

function buildSchoolSupportProfile(
  school: School,
  sectionMeetings: SectionMeeting[],
  offerings: Awaited<ReturnType<typeof getCatalogOfferingsForSchool>>,
): SchoolSupportProfile {
  const hasCatalog = offerings.length > 0;
  const hasSections = sectionMeetings.length > 0;
  const hasOfficialGrades = offerings.some(
    (item) =>
      item.coverageTier === "institutional_only" ||
      item.coverageTier === "institutional_plus_rmp" ||
      item.dataCompleteness === "institutional_full" ||
      item.dataCompleteness === "institutional_partial",
  );
  const hasRmp = offerings.some(
    (item) =>
      item.coverageTier === "institutional_plus_rmp" ||
      item.coverageTier === "rmp_only" ||
      item.sourceLabels.some((label) => /rmp|rate my professors/i.test(label)),
  );
  const uniqueCatalogCourses = new Set(offerings.map((item) => item.courseSlug)).size;
  const uniqueSectionCourses = new Set(sectionMeetings.map((item) => item.courseSlug)).size;
  const catalogCompletenessPct = hasCatalog ? 100 : 0;
  const sectionCompletenessPct = hasCatalog
    ? Math.max(0, Math.min(100, Math.round((uniqueSectionCourses / Math.max(uniqueCatalogCourses, 1)) * 100)))
    : 0;
  const meetingTimeCompletenessPct = hasSections
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (sectionMeetings.filter((item) => item.startTime && item.endTime && item.days.length).length /
              Math.max(sectionMeetings.length, 1)) *
              100,
          ),
        ),
      )
    : 0;
  const evidenceCompletenessPct = offerings.length
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (offerings.filter(
              (item) =>
                item.expectedGpa != null ||
                item.aRate != null ||
                item.rmpRating != null ||
                item.rmpDifficulty != null,
            ).length /
              offerings.length) *
              100,
          ),
        ),
      )
    : 0;
  const plannerReadiness: SchoolSupportProfile["plannerReadiness"] =
    hasSections && evidenceCompletenessPct >= 60
      ? "evidence_ready"
      : hasSections
        ? "schedule_ready"
        : hasCatalog
          ? "catalog_ready"
          : "directory_ready";

  return {
    plannerReadiness,
    hasCatalog,
    hasSections,
    hasInstructorDirectory: hasCatalog,
    hasPlanner: true,
    hasOfficialGrades,
    hasRmp,
    hasCommunityEvidence: offerings.some((item) =>
      item.sourceLabels.some((label) => /community|student/i.test(label)),
    ),
    evidenceFreshness: school.sourceStatus.freshness,
    sourceAvailability: [
      ...(hasCatalog ? (["catalog"] as const) : []),
      ...(hasSections ? (["schedule"] as const) : []),
      ...(hasOfficialGrades ? (["official_grades"] as const) : []),
      ...(hasRmp ? (["rmp"] as const) : []),
    ],
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
            : "Only school-directory coverage is available so far.",
  };
}

async function buildCatalogRecords(schoolSlug: string, limit?: number): Promise<CatalogRecord[]> {
  const courseGroups = await getCourseGroupsForSchool(schoolSlug);
  const courses = typeof limit === "number"
    ? courseGroups.slice(0, limit)
    : courseGroups;

  return courses.map((course) => ({
    id: `${schoolSlug}:${course.courseSlug}`,
    schoolSlug,
    courseSlug: course.courseSlug,
    courseCode: course.courseCode,
    courseName: course.courseName,
    department: course.department,
    summary: course.summary,
  }));
}

function buildEvidenceProfile(
  sourceKinds: EvidenceProfile["sourceKinds"],
  confidence: number,
): EvidenceProfile {
  const kinds = new Set(sourceKinds);
  return {
    sourceKinds: [...kinds],
    confidenceLabel: toConfidenceLabel(confidence),
    hasOfficialGrades: kinds.has("official_grades"),
    hasScheduleData: kinds.has("schedule"),
    hasRmp: kinds.has("rmp"),
    hasCommunityEvidence: kinds.has("community"),
    hasSyllabusEvidence: kinds.has("syllabus"),
  };
}

function resolveRankingMode(
  expectedGpa: number | null,
  aRate: number | null,
  hasMeetingTime: boolean,
): RankingMode {
  if (expectedGpa != null || aRate != null) {
    return "expected_gpa";
  }
  if (hasMeetingTime) {
    return "planner_fit";
  }
  return "ease_score";
}

function buildSectionFromMeeting(meeting: SectionMeeting): SectionRecord {
  const hasMeetingTime = Boolean(meeting.startTime && meeting.endTime && meeting.days.length);
  const rankingMode = resolveRankingMode(null, null, hasMeetingTime);

  return {
    id: meeting.sectionId,
    schoolSlug: meeting.schoolSlug,
    courseSlug: meeting.courseSlug,
    courseCode: meeting.courseSlug,
    courseName: meeting.courseSlug,
    professorSlug: null,
    professorName: meeting.instructorName,
    term: meeting.term,
    days: meeting.days,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    location: meeting.location,
    hasMeetingTime,
    sourceKey: meeting.sourceKey,
    rankingMode,
    evidenceProfile: buildEvidenceProfile(
      [
        "schedule",
        "catalog",
      ],
      hasMeetingTime ? 72 : 58,
    ),
  };
}

async function buildSectionRecords(schoolSlug: string): Promise<SectionRecord[]> {
  const [offerings, meetings] = await Promise.all([
    getCatalogOfferingsForSchool(schoolSlug),
    getCatalogSectionMeetingsForSchool(schoolSlug),
  ]);
  const meetingMap = new Map<string, SectionMeeting[]>();

  for (const meeting of meetings) {
    const key = `${meeting.courseSlug}:${meeting.instructorName ?? ""}`;
    meetingMap.set(key, [...(meetingMap.get(key) ?? []), meeting]);
  }

  const sections: SectionRecord[] = [];
  const usedMeetingIds = new Set<string>();

  for (const offering of offerings) {
    const matches =
      meetingMap.get(`${offering.courseSlug}:${offering.professorName}`) ??
      meetingMap.get(`${offering.courseSlug}:`) ??
      [];

    if (matches.length) {
      for (const meeting of matches) {
        usedMeetingIds.add(meeting.sectionId);
        const hasMeetingTime = Boolean(
          meeting.startTime &&
            meeting.endTime &&
            meeting.days.length,
        );

        sections.push({
          id: meeting.sectionId,
          schoolSlug,
          courseSlug: offering.courseSlug,
          courseCode: offering.courseCode,
          courseName: offering.courseName,
          professorSlug: offering.professorSlug,
          professorName: offering.professorName,
          term: meeting.term,
          days: meeting.days,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          location: meeting.location,
          hasMeetingTime,
          sourceKey: meeting.sourceKey,
          rankingMode: resolveRankingMode(
            offering.expectedGpa,
            offering.aRate,
            hasMeetingTime,
          ),
          evidenceProfile: buildEvidenceProfile(
            [
              "catalog",
              ...(hasMeetingTime ? (["schedule"] as const) : []),
              ...(offering.expectedGpa != null || offering.aRate != null
                ? (["official_grades"] as const)
                : []),
              ...(offering.rmpRating != null || offering.rmpDifficulty != null
                ? (["rmp"] as const)
                : []),
            ],
            offering.confidence,
          ),
          supportingOfferingId: offering.id,
        });
      }
      continue;
    }

    sections.push({
      id: `${offering.id}:synthetic`,
      schoolSlug,
      courseSlug: offering.courseSlug,
      courseCode: offering.courseCode,
      courseName: offering.courseName,
      professorSlug: offering.professorSlug,
      professorName: offering.professorName,
      term: offering.latestTerm,
      days: [],
      startTime: null,
      endTime: null,
      location: null,
      hasMeetingTime: false,
      sourceKey: offering.sourceLabels[0] ?? "published_catalog",
      rankingMode: resolveRankingMode(offering.expectedGpa, offering.aRate, false),
      evidenceProfile: buildEvidenceProfile(
        [
          "catalog",
          ...(offering.expectedGpa != null || offering.aRate != null
            ? (["official_grades"] as const)
            : []),
          ...(offering.rmpRating != null || offering.rmpDifficulty != null
            ? (["rmp"] as const)
            : []),
        ],
        offering.confidence,
      ),
      supportingOfferingId: offering.id,
    });
  }

  for (const meeting of meetings) {
    if (!usedMeetingIds.has(meeting.sectionId)) {
      sections.push(buildSectionFromMeeting(meeting));
    }
  }

  return sections;
}

function normalizeCourseSlugs(courseSlugs: string[] | undefined) {
  return [...new Set((courseSlugs ?? []).map((item) => item.trim()).filter(Boolean))];
}

function filterSectionsByCourseSlugs(
  sections: SectionRecord[],
  courseSlugs: string[],
) {
  if (!courseSlugs.length) {
    return sections;
  }

  const allowed = new Set(courseSlugs);
  return sections.filter((section) => allowed.has(section.courseSlug));
}

export async function getPlannerSchoolSnapshot(
  schoolSlug: string,
  options: PlannerSnapshotOptions = {},
): Promise<PublishedPlannerSchoolSnapshot | undefined> {
  const [catalogSchool, directorySchool] = await Promise.all([
    getCatalogSchoolBySlug(schoolSlug),
    getDirectorySchoolBySlug(schoolSlug),
  ]);
  const school = catalogSchool ?? directorySchool;
  if (!school) {
    return undefined;
  }

  const courseSlugs = normalizeCourseSlugs(options.courseSlugs);
  const [sections, catalogPreview, sectionMeetings, schoolOfferings, updatedAt, courseGroups] = await Promise.all([
    options.includeSections === false
      ? Promise.resolve([] as SectionRecord[])
      : buildSectionRecords(schoolSlug).then((records) =>
          filterSectionsByCourseSlugs(records, courseSlugs),
        ),
    options.includeCatalog === false
      ? Promise.resolve([] as CatalogRecord[])
      : buildCatalogRecords(schoolSlug, options.catalogLimit),
    getCatalogSectionMeetingsForSchool(schoolSlug),
    getCatalogOfferingsForSchool(schoolSlug),
    getCatalogUpdatedAt(),
    getCourseGroupsForSchool(schoolSlug),
  ]);
  const supportProfile = school.supportProfile ?? buildSchoolSupportProfile(
    school,
    sectionMeetings,
    schoolOfferings,
  );

  return {
    school: {
      ...school,
      supportProfile,
    },
    supportProfile,
    updatedAt,
    catalog: catalogPreview,
    sections,
    instructorCount: new Set(
      sections
        .map((item) => item.professorSlug ?? item.professorName ?? "")
        .filter(Boolean),
    ).size,
    courseCount: courseSlugs.length
      ? courseSlugs.length
      : courseGroups.length,
  };
}

export async function getPlannerSnapshotResponse(
  schoolSlug: string,
  options: { catalogPreviewLimit?: number } = {},
): Promise<PlannerSnapshotResponse | undefined> {
  const snapshot = await getPlannerSchoolSnapshot(schoolSlug, {
    includeCatalog: true,
    includeSections: false,
    catalogLimit: options.catalogPreviewLimit ?? 12,
  });

  if (!snapshot) {
    return undefined;
  }

  const schoolOfferings = await getCatalogOfferingsForSchool(schoolSlug);
  const sectionMeetings = await getCatalogSectionMeetingsForSchool(schoolSlug);

  return {
    school: snapshot.school,
    supportProfile: snapshot.supportProfile,
    updatedAt: snapshot.updatedAt,
    courseCount: snapshot.courseCount,
    instructorCount: new Set(
      schoolOfferings
        .map((item) => item.professorSlug || item.professorName)
        .filter(Boolean),
    ).size,
    catalogPreview: snapshot.catalog,
    sectionPreviewCount: sectionMeetings.length,
  };
}

export async function getPlannerSectionSlice(
  schoolSlug: string,
  courseSlugs?: string[],
): Promise<PlannerSectionSliceResponse | undefined> {
  const normalizedCourseSlugs = normalizeCourseSlugs(courseSlugs);
  const snapshot = await getPlannerSchoolSnapshot(schoolSlug, {
    includeCatalog: false,
    includeSections: true,
    courseSlugs: normalizedCourseSlugs,
  });

  if (!snapshot) {
    return undefined;
  }

  return {
    school: snapshot.school,
    supportProfile: snapshot.supportProfile,
    updatedAt: snapshot.updatedAt,
    courseSlugs: normalizedCourseSlugs,
    sections: snapshot.sections,
    sectionCount: snapshot.sections.length,
  };
}

async function sortOfferingsByMode(
  schoolOfferings: ProfessorCourseSummary[],
  courseSlug: string,
  rankingMode: RankingMode,
) {
  const offerings = [...schoolOfferings].filter(
    (item) => item.courseSlug === courseSlug,
  );

  return offerings.sort((left, right) => {
    if (rankingMode === "ease_score") {
      return (
        (right.classifyScore ?? 0) -
          (left.classifyScore ?? 0) ||
        (right.rmpRating ?? 0) - (left.rmpRating ?? 0) ||
        right.confidence - left.confidence
      );
    }

    if (rankingMode === "planner_fit") {
      return (
        Number(right.hasSectionPlanning) -
          Number(left.hasSectionPlanning) ||
        (right.expectedGpa ?? right.classifyScore ?? 0) -
          (left.expectedGpa ?? left.classifyScore ?? 0) ||
        right.confidence - left.confidence
      );
    }

    return (
      (right.expectedGpa ?? 0) -
        (left.expectedGpa ?? 0) ||
      (right.aRate ?? 0) - (left.aRate ?? 0) ||
      (right.classifyScore ?? 0) - (left.classifyScore ?? 0)
    );
  });
}

function parseMinutes(value: string | null) {
  if (!value) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function sectionsConflict(left: SectionRecord, right: SectionRecord) {
  if (!left.hasMeetingTime || !right.hasMeetingTime) {
    return false;
  }

  const sharedDays = left.days.filter((day) => right.days.includes(day));
  if (!sharedDays.length) {
    return false;
  }

  const leftStart = parseMinutes(left.startTime);
  const leftEnd = parseMinutes(left.endTime);
  const rightStart = parseMinutes(right.startTime);
  const rightEnd = parseMinutes(right.endTime);

  if (
    leftStart == null ||
    leftEnd == null ||
    rightStart == null ||
    rightEnd == null
  ) {
    return false;
  }

  return leftStart < rightEnd && rightStart < leftEnd;
}

export async function solvePlannerSelection(options: {
  schoolSlug: string;
  courseSlugs: string[];
  rankingMode?: RankingMode;
}): Promise<PlannerSolveResponse | undefined> {
  const normalizedCourseSlugs = normalizeCourseSlugs(options.courseSlugs);
  const snapshot = await getPlannerSchoolSnapshot(options.schoolSlug, {
    includeCatalog: false,
    includeSections: true,
    courseSlugs: normalizedCourseSlugs,
  });
  if (!snapshot) {
    return undefined;
  }

  const rankingMode = options.rankingMode ?? "planner_fit";
  const schoolOfferings = await getCatalogOfferingsForSchool(options.schoolSlug);
  const warnings: string[] = [];
  const selections: Array<{
    courseSlug: string;
    section: SectionRecord | null;
  }> = [];

  for (const courseSlug of normalizedCourseSlugs) {
    const ranked = await sortOfferingsByMode(schoolOfferings, courseSlug, rankingMode);
    if (!ranked.length) {
      warnings.push(`No published course options are available yet for ${courseSlug}.`);
      selections.push({ courseSlug, section: null });
      continue;
    }

    const candidateSections = snapshot.sections.filter(
      (section) =>
        section.courseSlug === courseSlug &&
        (!section.supportingOfferingId ||
          ranked.some((offering) => offering.id === section.supportingOfferingId)),
    );
    const orderedSections = [
      ...candidateSections.sort((left, right) => {
        const leftIndex = ranked.findIndex(
          (offering) => offering.id === left.supportingOfferingId,
        );
        const rightIndex = ranked.findIndex(
          (offering) => offering.id === right.supportingOfferingId,
        );
        return leftIndex - rightIndex;
      }),
    ];

    const selected = orderedSections.find(
      (section) =>
        !selections.some(
          (existing) => existing.section && sectionsConflict(existing.section, section),
        ),
    );

    if (selected) {
      selections.push({ courseSlug, section: selected });
      continue;
    }

    const fallback = orderedSections[0] ?? null;
    if (fallback) {
      warnings.push(
        `${fallback.courseCode} could not be placed without a schedule conflict using the current section data.`,
      );
    } else {
      warnings.push(
        `${ranked[0]?.courseCode ?? courseSlug} has no section schedule yet. Showing the best instructor row instead.`,
      );
    }
    selections.push({ courseSlug, section: fallback });
  }

  return {
    school: snapshot.school,
    supportProfile: snapshot.supportProfile,
    rankingMode,
    selections,
    warnings,
    updatedAt: snapshot.updatedAt,
  };
}
