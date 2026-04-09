import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let catalog: typeof import("../lib/catalog");

beforeAll(async () => {
  catalog = await import("../lib/catalog");
});

describe("catalog aggregates", () => {
  it("derives department aggregates for native-coverage schools", async () => {
    const { getDepartmentAggregatesForSchool } = catalog;
    const departments = await getDepartmentAggregatesForSchool("texas-am");
    expect(departments.some((item) => item.department === "Engineering")).toBe(true);
    expect(departments.some((item) => item.department === "Computer Science")).toBe(true);
  }, 120000);

  it("adds a General Engineering department for first-year engineering offerings", async () => {
    const {
      getDepartmentAggregate,
      getDepartmentOfferingsForSchool,
    } = catalog;
    const [department, offerings] = await Promise.all([
      getDepartmentAggregate("texas-am", "general-engineering"),
      getDepartmentOfferingsForSchool("texas-am", "general-engineering"),
    ]);

    expect(department?.department).toBe("General Engineering");
    expect(offerings.length).toBeGreaterThan(0);
    expect(
      offerings.every(
        (item) =>
          /^ENGR\s*1\d{2}\b/i.test(item.courseCode) ||
          /engineering lab i|engineering lab 1|introduction to engineering|intro to engineering|engineering foundations|first-year engineering|general engineering/i.test(
            item.courseName,
          ),
      ),
    ).toBe(true);
  }, 120000);

  it("attaches department deltas to professor profiles", async () => {
    const { getProfessorProfile } = catalog;
    const profile = await getProfessorProfile("texas-am", "s-lupoli");
    expect(profile?.offerings[0]?.departmentDelta?.classifyScoreDelta).not.toBeNull();
    expect(profile?.offerings[0]?.departmentDelta?.baselineLabel).toContain("department");
  });

  it("builds professor directory rows separately from course-level offerings", async () => {
    const { getProfessorDirectoryRowsForSchool } = catalog;
    const rows = await getProfessorDirectoryRowsForSchool("texas-am");
    const professor = rows.find((item) => item.professorSlug === "s-lupoli");

    expect(rows.length).toBeGreaterThan(0);
    expect(professor?.professorName).toBe("S. Lupoli");
    expect(professor?.courseCount).toBeGreaterThan(0);
    expect(Array.isArray(professor?.departments)).toBe(true);
    expect(professor?.coverageLevel).toBeDefined();
  });

  it("exposes grade distribution series for course pages", async () => {
    const { getGradeDistributionSeriesForCourse } = catalog;
    const series = await getGradeDistributionSeriesForCourse(
      "texas-am",
      "engr-102-engineering-lab-i-computation",
    );
    expect(series.length).toBeGreaterThan(0);
    expect(series[0]?.buckets).toHaveLength(5);
  });

  it("aggregates course trend metrics across offerings", async () => {
    const { getCourseTrend } = catalog;
    const trend = await getCourseTrend(
      "texas-am",
      "engr-102-engineering-lab-i-computation",
    );
    expect(trend.length).toBeGreaterThan(0);
    expect(trend.some((point) => point.aPct != null)).toBe(true);
  });

  it("attaches planner support profiles to published schools", async () => {
    const { getCatalogSchoolBySlug } = catalog;
    const school = await getCatalogSchoolBySlug("texas-am");

    expect(school?.supportProfile?.hasPlanner).toBe(true);
    expect(school?.supportProfile?.plannerReadiness).toBeDefined();
    expect(Array.isArray(school?.supportProfile?.sourceAvailability)).toBe(true);
    expect((school?.supportProfile?.catalogCompletenessPct ?? 0) >= 0).toBe(true);
    expect((school?.supportProfile?.evidenceCompletenessPct ?? 0) >= 0).toBe(true);
  });

  it("keeps readiness and completeness honest for heavily published schools", async () => {
    const { getCatalogSchoolBySlug } = catalog;
    const school = await getCatalogSchoolBySlug("texas-am");

    expect(["catalog_ready", "schedule_ready", "evidence_ready"]).toContain(
      school?.supportProfile?.plannerReadiness,
    );
    expect((school?.supportProfile?.sectionCompletenessPct ?? 0)).toBeGreaterThanOrEqual(0);
    expect((school?.supportProfile?.evidenceCompletenessPct ?? 0) > 0).toBe(true);
    if ((school?.supportProfile?.sectionCompletenessPct ?? 0) === 0) {
      expect(school?.supportProfile?.plannerReadiness).toBe("catalog_ready");
    }
  });

  it("normalizes repeated course names from published offerings", async () => {
    const { getCatalogOfferingsForSchool } = catalog;
    const repeatedNameRow = (await getCatalogOfferingsForSchool("texas-am")).find(
      (item) => item.courseCode === "COMM 230",
    );

    expect(repeatedNameRow?.courseName).not.toBe("COMM 230");
    expect(repeatedNameRow?.courseName?.toLowerCase()).toContain("communication");
  });

  it("polishes a few known TAMU abbreviated course names for display", async () => {
    const { getCatalogOfferingsForSchool } = catalog;
    const offerings = await getCatalogOfferingsForSchool("texas-am");

    expect(
      offerings.find((item) => item.courseCode === "ALEC 670")?.courseName,
    ).toBe("Agricultural Leadership, Education & Communication");
    expect(
      offerings.find((item) => item.courseCode === "LDTC 649")?.courseName,
    ).toBe("Teaching, Learning & Culture");
    expect(
      offerings.find((item) => item.courseCode === "VTPP 605")?.courseName,
    ).toBe("Veterinary Physiology & Pharmacology");
    expect(
      offerings.find((item) => item.courseCode === "RWFM 660")?.courseName,
    ).toBe("Rangeland, Wildlife & Fisheries Management");
  });
});
