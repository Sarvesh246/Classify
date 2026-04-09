import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/published-catalog-db-source", () => ({
  hasPublishedCatalogDbConfig: () => true,
  readPublishedCatalogSnapshotFromDb: vi.fn(async () => null),
}));

vi.mock("@/lib/published-catalog-file-source", () => ({
  getPublishedCatalogFileSourceInfo: () => ({ kind: "file" as const, path: "", exists: true }),
  readPublishedCatalogSnapshotFromFile: vi.fn(() => {
    throw new Error("published_catalog.json must not be read in production");
  }),
}));

describe("published catalog origin (production, DB empty)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to file when DB is empty", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { readPublishedCatalogSnapshot, getPublishedCatalogReadTrace } = await import(
      "@/lib/published-catalog-source"
    );
    await expect(readPublishedCatalogSnapshot()).rejects.toThrow(
      "published_catalog.json must not be read in production",
    );
    expect(getPublishedCatalogReadTrace().publishedDataFrom).toBe("none");
    expect(getPublishedCatalogReadTrace().publishedSnapshotLoaded).toBe(false);
  });
});
