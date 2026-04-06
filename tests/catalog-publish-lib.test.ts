import { describe, expect, it } from "vitest";
import type { PublishedCatalogSnapshot } from "../scripts/catalog-publish-lib";
import { buildPayload, validateSnapshot } from "../scripts/catalog-publish-lib";

describe("catalog publish professor identity support", () => {
  it("publishes professor identities and sections without offering summaries", () => {
    const snapshot: PublishedCatalogSnapshot = {
      updatedAt: "2026-04-05T00:00:00.000Z",
      schools: [
        {
          id: "school:example-u",
          slug: "example-u",
          name: "Example University",
          shortName: "Example U",
          aliases: ["EU"],
          city: "Austin",
          state: "TX",
          kind: "Public",
          coverageTier: "rmp_only",
          sourceStatus: {
            primary: "School directory only",
            fallback: "Rate My Professors",
            freshness: "RMP snapshot",
            note: "Directory-first test school.",
          },
          supportProfile: {
            plannerReadiness: "directory_ready",
            hasCatalog: false,
            hasSections: false,
            hasInstructorDirectory: true,
            hasPlanner: true,
            hasOfficialGrades: false,
            hasRmp: true,
            hasCommunityEvidence: false,
            evidenceFreshness: "RMP snapshot",
            sourceAvailability: ["rmp"],
            catalogCompletenessPct: 0,
            sectionCompletenessPct: 0,
            meetingTimeCompletenessPct: 0,
            evidenceCompletenessPct: 0,
            readinessReason: "RMP-only identity coverage is live.",
          },
        },
      ],
      offerings: [],
      professorDirectory: [
        {
          id: "profdir:example-u:jane-doe",
          schoolSlug: "example-u",
          schoolName: "Example University",
          professorSlug: "jane-doe",
          professorName: "Jane Doe",
          professorTitle: "Computer Science",
          departments: ["Computer Science"],
          coursePrefixes: ["CS"],
          courseCodes: ["CS 101"],
          courseCount: 1,
          sectionCount: 1,
          coverageTier: "rmp_only",
          coverageLevel: "stats_partial",
          statsAvailability: "rmp_only",
          evidenceFreshness: "RMP snapshot",
          sourceKinds: ["rmp"],
          hasInstitutionalStats: false,
          hasRmp: true,
          hasSchedulePresence: false,
          expectedGpa: null,
          aRate: null,
          classifyScore: null,
          rmpRating: 4.6,
          rmpDifficulty: 2.1,
          sampleSize: 12,
          trend: [],
          tags: ["Clear lectures"],
          summary: "RMP-backed professor profile.",
        },
      ],
      sections: [
        {
          id: "section:example-u:cs-101:001",
          schoolSlug: "example-u",
          courseSlug: "cs-101-intro-to-cs",
          courseCode: "CS 101",
          courseName: "Intro to CS",
          professorSlug: null,
          professorName: "Jane Doe",
          term: "Fall 2026",
          rankingMode: "planner_fit",
          evidenceProfile: {
            sourceKinds: ["catalog", "schedule"],
            confidenceLabel: "medium",
            hasOfficialGrades: false,
            hasScheduleData: true,
            hasRmp: false,
            hasCommunityEvidence: false,
            hasSyllabusEvidence: false,
          },
          days: ["M", "W"],
          startTime: "10:00",
          endTime: "10:50",
          location: "GDC 1.304",
          hasMeetingTime: true,
          sourceKey: "example-catalog",
        },
      ],
    };

    const payload = buildPayload(snapshot);
    const school = payload.schools.find((item) => item.slug === "example-u");

    expect(payload.professors).toHaveLength(1);
    expect(payload.courses).toHaveLength(1);
    expect(payload.sections).toHaveLength(1);
    expect(payload.rmpRatings).toHaveLength(1);
    expect(school?.has_instructor_directory).toBe(true);
    expect(school?.has_sections).toBe(true);
    expect(school?.has_catalog).toBe(true);
  });

  it("fails validation when instructor coverage is claimed but no identities are published", () => {
    const snapshot: PublishedCatalogSnapshot = {
      updatedAt: "2026-04-05T00:00:00.000Z",
      schools: [
        {
          id: "school:broken-u",
          slug: "broken-u",
          name: "Broken University",
          shortName: "Broken U",
          aliases: [],
          city: "Dallas",
          state: "TX",
          kind: "Private",
          coverageTier: "rmp_only",
          sourceStatus: {
            primary: "School directory only",
            fallback: "Rate My Professors",
            freshness: "RMP snapshot",
            note: "Broken test school.",
          },
          supportProfile: {
            plannerReadiness: "directory_ready",
            hasCatalog: false,
            hasSections: false,
            hasInstructorDirectory: true,
            hasPlanner: true,
            hasOfficialGrades: false,
            hasRmp: false,
            hasCommunityEvidence: false,
            evidenceFreshness: "RMP snapshot",
            sourceAvailability: [],
          },
        },
      ],
      offerings: [
        {
          id: "placeholder-offering",
          schoolSlug: "some-other-school",
          professorSlug: "someone",
          courseSlug: "x",
          courseCode: "X 101",
          courseName: "X",
          professorName: "Someone",
          department: "General",
          classifyScore: null,
          expectedGpa: null,
          aRate: null,
          rmpRating: null,
          rmpDifficulty: null,
          trendDelta: null,
          confidence: 50,
          sampleSize: 10,
          coverageTier: "rmp_only",
          latestTerm: "Fall 2026",
          termCount: 1,
          matchConfidence: 50,
          tags: [],
          summary: "placeholder",
          professorTitle: "Instructor",
          professorSummary: "placeholder",
          courseSummary: "placeholder",
          freshness: "RMP snapshot",
          sourceLabels: ["RMP"],
          dataCompleteness: "rmp_only",
          trend: [],
        },
      ],
    };

    const payload = buildPayload(snapshot);
    const validation = validateSnapshot(snapshot, payload);

    expect(validation.ok).toBe(false);
    expect(
      validation.failures.some((item) =>
        item.includes("claims instructor coverage but publishes zero professor identities"),
      ),
    ).toBe(true);
  });

  it("does not create generic duplicate course rows from professor-directory course codes when offerings already define the course", () => {
    const snapshot: PublishedCatalogSnapshot = {
      updatedAt: "2026-04-05T00:00:00.000Z",
      schools: [
        {
          id: "school:tamu",
          slug: "texas-am",
          name: "Texas A&M University",
          shortName: "Texas A&M",
          aliases: [],
          city: "College Station",
          state: "TX",
          kind: "Public",
          coverageTier: "institutional_plus_rmp",
          sourceStatus: {
            primary: "Official publish",
            fallback: "RMP",
            freshness: "Updated 2026-04-05",
            note: "TAMU coverage",
          },
          supportProfile: {
            plannerReadiness: "catalog_ready",
            hasCatalog: true,
            hasSections: false,
            hasInstructorDirectory: true,
            hasPlanner: true,
            hasOfficialGrades: true,
            hasRmp: true,
            hasCommunityEvidence: false,
            evidenceFreshness: "Updated 2026-04-05",
            sourceAvailability: ["catalog", "official_grades", "rmp"],
          },
        },
      ],
      offerings: [
        {
          id: "texas-am-csce-222-lupoli-s",
          schoolSlug: "texas-am",
          professorSlug: "lupoli-s",
          courseSlug: "csce-222-computer-science-and-engineering",
          courseCode: "CSCE 222",
          courseName: "Discrete Structures for Computing",
          professorName: "S. Lupoli",
          department: "Computer Science",
          classifyScore: 88,
          expectedGpa: 3.4,
          aRate: 54,
          rmpRating: 4.1,
          rmpDifficulty: 2.7,
          trendDelta: 0.1,
          confidence: 90,
          sampleSize: 100,
          coverageTier: "institutional_plus_rmp",
          latestTerm: "Fall 2025",
          termCount: 3,
          matchConfidence: 95,
          tags: [],
          summary: "summary",
          professorTitle: "Instructor",
          professorSummary: "prof summary",
          courseSummary: "course summary",
          freshness: "Updated 2026-04-05",
          sourceLabels: ["Official"],
          dataCompleteness: "institutional_full",
          trend: [],
        },
      ],
      professorDirectory: [
        {
          id: "profdir:texas-am:lupoli-s",
          schoolSlug: "texas-am",
          schoolName: "Texas A&M University",
          professorSlug: "lupoli-s",
          professorName: "S. Lupoli",
          professorTitle: "Instructor",
          departments: ["Computer Science"],
          coursePrefixes: ["CSCE"],
          courseCodes: ["CSCE 222"],
          courseCount: 1,
          sectionCount: 0,
          coverageTier: "institutional_plus_rmp",
          coverageLevel: "stats_full",
          statsAvailability: "full",
          evidenceFreshness: "Updated 2026-04-05",
          sourceKinds: ["catalog", "official_grades", "rmp"],
          hasInstitutionalStats: true,
          hasRmp: true,
          hasSchedulePresence: false,
          expectedGpa: 3.4,
          aRate: 54,
          classifyScore: 88,
          rmpRating: 4.1,
          rmpDifficulty: 2.7,
          sampleSize: 100,
          trend: [],
          tags: [],
          summary: "summary",
        },
      ],
    };

    const payload = buildPayload(snapshot);
    const tamuCourses = payload.courses.filter((item) => item.school_id === "school:tamu");

    expect(tamuCourses).toHaveLength(1);
    expect(tamuCourses[0]?.id).toBe("course:school:tamu:csce-222-computer-science-and-engineering");
    expect(tamuCourses[0]?.name).toBe("Discrete Structures for Computing");
  });
});
