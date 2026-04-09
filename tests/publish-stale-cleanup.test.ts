import { describe, expect, it } from "vitest";

/**
 * Mirrors obsolete-id detection in `deleteMissingRows` (scripts/catalog-publish-lib.ts):
 * rows present in the DB for the school scope but missing from the published snapshot are removed.
 */
function obsoleteIds(existingIds: string[], desiredIds: string[]): string[] {
  const desired = new Set(desiredIds);
  return existingIds.filter((id) => !desired.has(id));
}

describe("publish stale-row cleanup (id set logic)", () => {
  it("flags ids that exist remotely but not in the desired snapshot", () => {
    expect(obsoleteIds(["a", "b", "c"], ["a", "c"])).toEqual(["b"]);
  });

  it("returns empty when every existing id is desired", () => {
    expect(obsoleteIds(["x", "y"], ["x", "y", "z"])).toEqual([]);
  });

  it("returns all existing when desired is empty", () => {
    expect(obsoleteIds(["only"], [])).toEqual(["only"]);
  });
});
