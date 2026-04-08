import { describe, expect, it } from "vitest";
import {
  formatProfessorDisplayName,
  resolveProfessorProfileName,
} from "@/lib/professor-display";

describe("formatProfessorDisplayName", () => {
  it("normalizes LAST INITIAL (registrar caps)", () => {
    expect(formatProfessorDisplayName("CHU W")).toBe("W. Chu");
    expect(formatProfessorDisplayName("SORESCU S")).toBe("S. Sorescu");
  });

  it("normalizes INITIAL LAST", () => {
    expect(formatProfessorDisplayName("W CHU")).toBe("W. Chu");
  });

  it("leaves already mixed-case names lightly title-cased", () => {
    expect(formatProfessorDisplayName("jane doe")).toBe("Jane Doe");
  });

  it("uses the fullest matching professor name for the profile page", () => {
    expect(
      resolveProfessorProfileName("W. Chu", ["Wei Chu", "W. Chu", "William Chen"]),
    ).toBe("Wei Chu");
  });

  it("keeps the abbreviated form when no trustworthy full-name candidate exists", () => {
    expect(
      resolveProfessorProfileName("S. Lupoli", ["Sam Patel", "R. Elms", "S. Lupoli"]),
    ).toBe("S. Lupoli");
  });

  it("keeps the abbreviated form when multiple full-name candidates remain ambiguous", () => {
    expect(
      resolveProfessorProfileName("A. Smith", ["Alice Smith", "Andrew Smith", "A. Smith"]),
    ).toBe("A. Smith");
  });
});
