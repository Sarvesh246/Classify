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
  }, 120000);

  it("keeps school labels canonical instead of rendering alias blobs", async () => {
    const results = await searchDirectory("UT Southwestern", { limit: 12 });
    const schoolHit = results.find((item) => item.type === "school");

    expect(schoolHit?.label).toBeDefined();
    expect((schoolHit?.label?.length ?? 0) < 48).toBe(true);
    expect(schoolHit?.label).not.toContain("Graduate School of Biomedical Sciences");
  });

  it("keeps school-name queries from leaking unrelated catalog rows into combobox suggestions", async () => {
    const results = await searchDirectory("UT Southwestern", {
      limit: 8,
      surface: "combobox",
    });

    expect(results[0]?.type).toBe("school");
    expect(results.every((item) => item.type === "school" || item.school === "UT Southwestern")).toBe(
      true,
    );
  });

  it("dedupes directory and published school hits that share the same visible label", async () => {
    const results = await searchDirectory("Georgia Tech", {
      limit: 10,
      surface: "combobox",
    });

    expect(results.filter((item) => item.type === "school" && item.label === "Georgia Tech")).toHaveLength(
      1,
    );
  });

  it("finds course-level and professor-level results for direct course searches", async () => {
    const results = await searchDirectory("CS 312", { limit: 10 });
    expect(results.some((item) => item.type === "course")).toBe(true);
    expect(results.some((item) => item.type === "professor")).toBe(true);
  });

  it("indexes Texas A&M as a strong school result", async () => {
    const results = await searchDirectory("Texas A&M", { limit: 10 });
    expect(results[0]?.type).toBe("school");
    expect(results.some((item) => item.label.includes("Texas A&M"))).toBe(true);
  });

  it("keeps Texas A and M school-first in combobox search", async () => {
    const results = await searchDirectory("texas a and m", {
      limit: 8,
      surface: "combobox",
    });

    expect(results[0]?.type).toBe("school");
    expect(results[0]?.slug).toBe("texas-am");
  });

  it("recovers likely school matches from misspellings", async () => {
    const results = await searchDirectory("university of tenneesee", {
      limit: 8,
      surface: "combobox",
    });

    expect(results[0]?.type).toBe("school");
    expect(results.some((item) => item.slug === "the-university-of-tennessee-knoxville")).toBe(true);
  });

  it("matches school ranking between type=all and type=school for the same query", async () => {
    const query = "Texas A&M";
    const cap = 24;
    const allType = await searchDirectory(query, { limit: cap, type: "all" });
    const schoolsFromAll = allType.filter((item) => item.type === "school");
    const schoolOnly = await searchDirectory(query, { limit: cap, type: "school" });

    expect(schoolOnly.every((item) => item.type === "school")).toBe(true);
    const n = Math.min(schoolsFromAll.length, schoolOnly.length);
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      expect(schoolOnly[i]?.label).toBe(schoolsFromAll[i]?.label);
      expect(schoolOnly[i]?.slug).toBe(schoolsFromAll[i]?.slug);
    }
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

  it("drops irrelevant matches instead of filling with noisy results", async () => {
    const results = await searchDirectory("qzzzz", { limit: 10 });
    expect(results).toHaveLength(0);
  });

  it("keeps school-scoped professor searches tightly relevant", async () => {
    const results = await searchDirectory("Altemose", {
      type: "professor",
      schoolSlug: "texas-am",
      limit: 12,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => /altemose/i.test(item.label))).toBe(true);
  });
});
