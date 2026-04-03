import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let searchDirectory: typeof import("../lib/server-directory").searchDirectory;

beforeAll(async () => {
  ({ searchDirectory } = await import("../lib/server-directory"));
});

describe("searchDirectory", () => {
  it("keeps schools ahead of courses and professors when the query is broad", async () => {
    const results = await searchDirectory("ut", { limit: 6 });
    expect(results[0]?.type).toBe("school");
    expect(results[0]?.label).toContain("UT Austin");
  });

  it("finds course-level and professor-level results for direct course searches", async () => {
    const results = await searchDirectory("CS 312", { limit: 10 });
    expect(results.some((item) => item.type === "course")).toBe(true);
    expect(results.some((item) => item.type === "professor")).toBe(true);
  });

  it("indexes Texas A&M as a native school result", async () => {
    const results = await searchDirectory("Texas A&M", { limit: 10 });
    expect(results[0]?.type).toBe("school");
    expect(results.some((item) => item.label.includes("Texas A&M"))).toBe(true);
  });

  it("supports school-scoped professor search for compare mode", async () => {
    const results = await searchDirectory("CSCE", {
      type: "professor",
      schoolSlug: "texas-am",
      limit: 12,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.type === "professor")).toBe(true);
    expect(results.every((item) => item.context.schoolSlug === "texas-am")).toBe(true);
  });
});
