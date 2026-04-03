import { describe, expect, it } from "vitest";
import {
  courseCodeKeyFromOffering,
  courseCodeKeyFromString,
  extractCourseCodeKeyFromQuery,
} from "@/lib/search-normalize";

describe("search-normalize course codes", () => {
  it("normalizes spaced and hyphen forms", () => {
    expect(courseCodeKeyFromString("FINC 422")).toBe("FINC422");
    expect(courseCodeKeyFromString("finc-422")).toBe("FINC422");
    expect(courseCodeKeyFromString("CSCE 221")).toBe("CSCE221");
  });

  it("extracts key from query with extra text", () => {
    expect(extractCourseCodeKeyFromQuery("FINC422 syllabus")).toBe("FINC422");
    expect(extractCourseCodeKeyFromQuery("take FINC 422")).toBe("FINC422");
    expect(courseCodeKeyFromString("take FINC 422")).toBe("FINC422");
  });

  it("offering course code", () => {
    expect(courseCodeKeyFromOffering("FINC 422")).toBe("FINC422");
  });
});
