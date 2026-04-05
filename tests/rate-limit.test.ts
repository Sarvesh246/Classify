import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("rateLimitRequest", () => {
  it("allows requests until the limit is reached", async () => {
    const { rateLimitRequest } = await import("../lib/rate-limit");
    const request = new Request("http://localhost/api/search", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    const first = rateLimitRequest(request, {
      key: "test_search",
      limit: 2,
      windowMs: 10_000,
    });
    const second = rateLimitRequest(request, {
      key: "test_search",
      limit: 2,
      windowMs: 10_000,
    });
    const third = rateLimitRequest(request, {
      key: "test_search",
      limit: 2,
      windowMs: 10_000,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });
});
