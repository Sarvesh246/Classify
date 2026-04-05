import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const minimalSchool = {
  id: "t",
  slug: "test-school",
  name: "Test University",
  shortName: "Test",
  city: "X",
  state: "Y",
  kind: "Public" as const,
  coverageTier: "rmp_only" as const,
  aliases: [] as string[],
  directoryCount: 0,
  sourceStatus: { primary: "p", fallback: "f", freshness: "now", note: "n" },
  descriptor: "d",
  programs: [] as string[],
};

const minimalSnapshot = {
  updatedAt: "2026-01-01T00:00:00.000Z",
  schools: [minimalSchool],
  offerings: [] as unknown[],
  departmentAggregates: [],
  gradeDistributionSeries: [],
  sectionMeetings: [],
};

vi.mock("@/lib/published-catalog-db-source", () => ({
  hasPublishedCatalogDbConfig: () => true,
  readPublishedCatalogSnapshotFromDb: vi.fn(async () => minimalSnapshot),
}));

vi.mock("@/lib/published-catalog-file-source", () => ({
  getPublishedCatalogFileSourceInfo: () => ({ kind: "file" as const, path: "", exists: false }),
  readPublishedCatalogSnapshotFromFile: vi.fn(() => {
    throw new Error("file must not load when DB succeeds");
  }),
}));

describe("published catalog origin (DB succeeds)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("records publishedDataFrom db", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { readPublishedCatalogSnapshot, getPublishedCatalogReadTrace } = await import(
      "@/lib/published-catalog-source"
    );
    await readPublishedCatalogSnapshot();
    const trace = getPublishedCatalogReadTrace();
    expect(trace.publishedDataFrom).toBe("db");
    expect(trace.publishedSnapshotLoaded).toBe(true);
    expect(trace.dbConfigured).toBe(true);
  });
});
