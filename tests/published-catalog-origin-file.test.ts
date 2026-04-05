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
  readPublishedCatalogSnapshotFromDb: vi.fn(async () => null),
}));

vi.mock("@/lib/published-catalog-file-source", () => ({
  getPublishedCatalogFileSourceInfo: () => ({ kind: "file" as const, path: "", exists: true }),
  readPublishedCatalogSnapshotFromFile: vi.fn(() => minimalSnapshot),
}));

describe("published catalog origin (DB empty, dev file)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("records publishedDataFrom file in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { readPublishedCatalogSnapshot, getPublishedCatalogReadTrace } = await import(
      "@/lib/published-catalog-source"
    );
    await readPublishedCatalogSnapshot();
    expect(getPublishedCatalogReadTrace().publishedDataFrom).toBe("file");
    expect(getPublishedCatalogReadTrace().publishedSnapshotLoaded).toBe(true);
  });
});
