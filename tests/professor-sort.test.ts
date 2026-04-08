import { describe, expect, it } from "vitest";
import { professorDepartmentSortKey, professorLastNameSortKey } from "@/lib/professor-sort";

describe("professorLastNameSortKey", () => {
  it("sorts by final token for First Last", () => {
    expect(professorLastNameSortKey("Jane Smith")).toBe("smith");
    expect(professorLastNameSortKey("W. Chu")).toBe("chu");
  });

  it("sorts van/von-style fragments after initials as compound last name", () => {
    expect(professorLastNameSortKey("D. Van Poppel")).toBe("van poppel");
  });

  it("single-token names use whole string", () => {
    expect(professorLastNameSortKey("Madonna")).toBe("madonna");
  });

  it("empty after trim yields empty key", () => {
    expect(professorLastNameSortKey("   ")).toBe("");
  });
});

describe("professorDepartmentSortKey", () => {
  it("uses first department alphabetically", () => {
    expect(professorDepartmentSortKey(["Zoology", "Anthropology"])).toBe("anthropology");
  });

  it("empty departments sort last", () => {
    expect(professorDepartmentSortKey([])).toBe("\uffff");
  });
});
