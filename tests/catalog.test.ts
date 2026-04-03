import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let catalog: typeof import("../lib/catalog");

beforeAll(async () => {
  catalog = await import("../lib/catalog");
});

describe("catalog aggregates", () => {
  it("derives department aggregates for native-coverage schools", () => {
    const { getDepartmentAggregatesForSchool } = catalog;
    const departments = getDepartmentAggregatesForSchool("texas-am");
    expect(departments.some((item) => item.department === "Engineering")).toBe(true);
    expect(departments.some((item) => item.department === "Computer Science")).toBe(true);
  });

  it("attaches department deltas to professor profiles", () => {
    const { getProfessorProfile } = catalog;
    const profile = getProfessorProfile("texas-am", "s-lupoli");
    expect(profile?.professor.departmentDelta?.classifyScoreDelta).not.toBeNull();
    expect(profile?.professor.departmentDelta?.baselineLabel).toContain("department");
  });

  it("exposes grade distribution series for course pages", () => {
    const { getGradeDistributionSeriesForCourse } = catalog;
    const series = getGradeDistributionSeriesForCourse(
      "texas-am",
      "engr-102-engineering-lab-i-computation",
    );
    expect(series.length).toBeGreaterThan(0);
    expect(series[0]?.buckets).toHaveLength(5);
  });

  it("aggregates course trend metrics across offerings", () => {
    const { getCourseTrend } = catalog;
    const trend = getCourseTrend(
      "texas-am",
      "engr-102-engineering-lab-i-computation",
    );
    expect(trend.length).toBeGreaterThan(0);
    expect(trend.some((point) => point.aPct != null)).toBe(true);
  });
});
