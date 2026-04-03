import { describe, expect, it } from "vitest";
import { formatProfessorDisplayName } from "@/lib/professor-display";

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
});
