import { describe, expect, it } from "vitest";
import { prefilterSchoolsByTextQuery } from "@/lib/school-search-prefilter";
import type { School } from "@/lib/types";

const sample: School[] = [
  {
    id: "1",
    slug: "ut-austin",
    name: "The University of Texas at Austin",
    shortName: "UT Austin",
    city: "Austin",
    state: "TX",
    kind: "Public",
    coverageTier: "institutional_plus_rmp",
    aliases: ["UT"],
    directoryCount: 1,
    sourceStatus: {
      primary: "x",
      fallback: "y",
      freshness: "z",
      note: "n",
    },
    descriptor: "d",
    programs: [],
  },
  {
    id: "2",
    slug: "texas-am",
    name: "Texas A & M University-College Station",
    shortName: "Texas A&M",
    city: "College Station",
    state: "TX",
    kind: "Public",
    coverageTier: "rmp_only",
    aliases: ["TAMU"],
    directoryCount: 1,
    sourceStatus: {
      primary: "x",
      fallback: "y",
      freshness: "z",
      note: "n",
    },
    descriptor: "d",
    programs: [],
  },
  {
    id: "3",
    slug: "michigan",
    name: "University of Michigan-Ann Arbor",
    shortName: "Michigan",
    city: "Ann Arbor",
    state: "MI",
    kind: "Public",
    coverageTier: "rmp_only",
    aliases: [],
    directoryCount: 1,
    sourceStatus: {
      primary: "x",
      fallback: "y",
      freshness: "z",
      note: "n",
    },
    descriptor: "d",
    programs: [],
  },
];

describe("prefilterSchoolsByTextQuery", () => {
  it("returns all schools for empty query", () => {
    expect(prefilterSchoolsByTextQuery(sample, "")).toHaveLength(3);
  });

  it("narrows to schools containing every significant token", () => {
    const out = prefilterSchoolsByTextQuery(sample, "austin texas");
    expect(out.map((s) => s.slug)).toEqual(["ut-austin"]);
  });

  it("falls back to full list when no AND match (fuzzy path handled later)", () => {
    const out = prefilterSchoolsByTextQuery(sample, "xyzabc");
    expect(out).toHaveLength(3);
  });

  it("ignores single-character tokens for narrowing", () => {
    const out = prefilterSchoolsByTextQuery(sample, "a b");
    expect(out).toHaveLength(3);
  });
});
