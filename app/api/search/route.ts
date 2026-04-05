import { NextRequest, NextResponse } from "next/server";
import {
  getSuggestedHits,
  searchDirectory,
} from "@/lib/server-directory";
import { rateLimitRequest } from "@/lib/rate-limit";
import { serverLog } from "@/lib/server-logger";

const MAX_SEARCH_LIMIT = 50;
const DEFAULT_LIMIT = 12;

function clampLimit(raw: string | null): number {
  const n = Number(raw ?? DEFAULT_LIMIT);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_SEARCH_LIMIT);
}

export async function GET(request: NextRequest) {
  try {
    const rateLimit = rateLimitRequest(request, {
      key: "search",
      limit: 90,
      windowMs: 60_000,
    });
    if (!rateLimit.ok) {
      return NextResponse.json(
        { results: [], error: "rate_limited" },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
    const type =
      request.nextUrl.searchParams.get("type")?.trim() || undefined;
    const schoolSlug =
      request.nextUrl.searchParams.get("schoolSlug")?.trim() || undefined;
    const surface =
      request.nextUrl.searchParams.get("surface")?.trim() === "page"
        ? "page"
        : "combobox";
    const limit = clampLimit(request.nextUrl.searchParams.get("limit"));
    const options = {
      limit,
      type:
        type === "school" || type === "course" || type === "professor"
          ? type
          : "all",
      schoolSlug,
      surface,
    } as const;

    const results = query
      ? await searchDirectory(query, options)
      : await getSuggestedHits(options);

    if (query || schoolSlug || options.type !== "all") {
      serverLog.info("search_query_completed", {
        query,
        type: options.type,
        schoolSlug: schoolSlug ?? null,
        surface,
        resultCount: results.length,
        empty: results.length === 0,
      });
    }

    return NextResponse.json({ results }, {
      headers: {
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
  } catch (err) {
    serverLog.error("search_api_failed", {
      error: String(err),
      path: request.nextUrl.pathname,
    });
    return NextResponse.json(
      { results: [], error: "search_unavailable" },
      { status: 503 },
    );
  }
}
