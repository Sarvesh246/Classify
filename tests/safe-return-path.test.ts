import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/lib/safe-return-path";

describe("safeReturnPath", () => {
  it("allows simple paths", () => {
    expect(safeReturnPath("/")).toBe("/");
    expect(safeReturnPath("/search")).toBe("/search");
    expect(safeReturnPath("/compare?ids=a,b")).toBe("/compare?ids=a,b");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeReturnPath("//evil.com")).toBe("/");
    expect(safeReturnPath("//evil.com/path")).toBe("/");
    expect(safeReturnPath("https://evil.com/")).toBe("/");
    expect(safeReturnPath("http://evil.com/")).toBe("/");
  });

  it("rejects missing leading slash and backslashes", () => {
    expect(safeReturnPath("search")).toBe("/");
    expect(safeReturnPath("/\\evil")).toBe("/");
    expect(safeReturnPath("\\\\evil.com")).toBe("/");
  });

  it("handles nullish input", () => {
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath(undefined)).toBe("/");
    expect(safeReturnPath("", "/login")).toBe("/login");
  });
});
