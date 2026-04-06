import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let planner: typeof import("../lib/planner");

beforeAll(async () => {
  planner = await import("../lib/planner");
});

describe("planner snapshot", () => {
  it("returns a planner snapshot for catalog-backed schools", async () => {
    const snapshot = await planner.getPlannerSchoolSnapshot("texas-am");

    expect(snapshot?.school.slug).toBe("texas-am");
    expect(snapshot?.supportProfile.hasPlanner).toBe(true);
    expect(snapshot?.catalog.length).toBeGreaterThan(0);
    expect(snapshot?.sections.length).toBeGreaterThan(0);
  }, 120000);

  it("returns a thin planner bootstrap response", async () => {
    const snapshot = await planner.getPlannerSnapshotResponse("texas-am");

    expect(snapshot?.school.slug).toBe("texas-am");
    expect(snapshot?.catalogPreview.length).toBeGreaterThan(0);
    expect(snapshot?.catalogPreview.length).toBeLessThanOrEqual(12);
    expect(snapshot?.sectionPreviewCount).toBeGreaterThanOrEqual(0);
  });

  it("filters section slices by selected course", async () => {
    const slice = await planner.getPlannerSectionSlice("texas-am", [
      "engr-102-engineering-lab-i-computation",
    ]);

    expect(slice?.courseSlugs).toEqual(["engr-102-engineering-lab-i-computation"]);
    expect(slice?.sections.length).toBeGreaterThan(0);
    expect(
      slice?.sections.every(
        (section) => section.courseSlug === "engr-102-engineering-lab-i-computation",
      ),
    ).toBe(true);
  });

  it("solves a basic course selection with planner metadata", async () => {
    const result = await planner.solvePlannerSelection({
      schoolSlug: "texas-am",
      courseSlugs: ["engr-102-engineering-lab-i-computation"],
      rankingMode: "planner_fit",
    });

    expect(result?.school.slug).toBe("texas-am");
    expect(result?.rankingMode).toBe("planner_fit");
    expect(result?.selections).toHaveLength(1);
    expect(result?.selections[0]?.section).not.toBeNull();
  });
});
