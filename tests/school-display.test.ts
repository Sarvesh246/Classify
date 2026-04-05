import { describe, expect, it } from "vitest";

import {
  buildSchoolAliases,
  deriveSchoolShortName,
  isMalformedSchoolAlias,
} from "../lib/school-display";

describe("school display helpers", () => {
  it("rejects concatenated alias blobs as malformed display names", () => {
    const alias =
      "UT Southwestern Medical School UT Southwestern Graduate School of Biomedical Sciences UTSW Medical School UTSW Graduate School";

    expect(isMalformedSchoolAlias(alias)).toBe(true);
  });

  it("keeps compact aliases when they are valid display names", () => {
    expect(
      deriveSchoolShortName("The University of Texas at Austin", "UT Austin"),
    ).toBe("UT Austin");
  });

  it("splits multi-alias payloads and keeps the clean canonical alias", () => {
    expect(
      deriveSchoolShortName("Massachusetts Institute of Technology", "MIT, M.I.T."),
    ).toBe("MIT");
  });

  it("rejects ambiguous two-letter aliases and falls back to the official short form", () => {
    expect(deriveSchoolShortName("Utah Tech University", "UT")).toBe("Utah Tech");
  });

  it("falls back to a clean compact official-name short form when alias data is bad", () => {
    const alias =
      "UT Southwestern Medical School UT Southwestern Graduate School of Biomedical Sciences UTSW Medical School";

    expect(
      deriveSchoolShortName("University of Texas Southwestern Medical Center", alias),
    ).toBe("UT Southwestern");
  });

  it("omits malformed aliases from match metadata while keeping the canonical label", () => {
    const aliases = buildSchoolAliases(
      "University of Texas Southwestern Medical Center",
      "UT Southwestern Medical School UT Southwestern Graduate School of Biomedical Sciences",
      ["UT Southwestern"],
      "UT Southwestern",
    );

    expect(aliases).toContain("UT Southwestern");
    expect(aliases.some((value) => value.includes("Graduate School of Biomedical Sciences"))).toBe(
      false,
    );
  });

  it("expands comma-separated alias metadata into clean match aliases", () => {
    const aliases = buildSchoolAliases(
      "Massachusetts Institute of Technology",
      "MIT, M.I.T.",
      [],
      "MIT",
    );

    expect(aliases).toContain("MIT");
    expect(aliases).toContain("M.I.T.");
    expect(aliases).not.toContain("MIT, M.I.T.");
  });
});
