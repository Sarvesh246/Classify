import { NextRequest, NextResponse } from "next/server";
import {
  getSuggestedHits,
  searchDirectory,
} from "@/lib/server-directory";
import type { SearchHit, SearchHitType } from "@/lib/types";
import { rateLimitRequest } from "@/lib/rate-limit";
import { serverLog } from "@/lib/server-logger";

const MAX_SEARCH_LIMIT = 50;
const DEFAULT_LIMIT = 12;
const SEARCH_RESPONSE_CACHE_TTL_MS = 120_000;

type CachedSearchPayload = {
  expiresAt: number;
  results: SearchHit[];
};

const searchResponseCache = new Map<string, CachedSearchPayload>();
const inflightSearches = new Map<string, Promise<SearchHit[]>>();

function clampLimit(raw: string | null): number {
  const n = Number(raw ?? DEFAULT_LIMIT);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_SEARCH_LIMIT);
}

function buildSearchCacheKey(args: {
  query: string;
  type: SearchHitType | "all";
  schoolSlug?: string;
  surface: "combobox" | "page";
  limit: number;
}) {
  return JSON.stringify([
    args.query,
    args.type,
    args.schoolSlug ?? "",
    args.surface,
    args.limit,
  ]);
}

async function resolveSearchResultsWithCache(args: {
  query: string;
  type: SearchHitType | "all";
  schoolSlug?: string;
  surface: "combobox" | "page";
  limit: number;
}) {
  const cacheKey = buildSearchCacheKey(args);
  const now = Date.now();
  const cached = searchResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.results;
  }

  const inflight = inflightSearches.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const options = {
    limit: args.limit,
    type: args.type,
    schoolSlug: args.schoolSlug,
    surface: args.surface,
  } as const;

  const work = (args.query
    ? searchDirectory(args.query, options)
    : getSuggestedHits(options)
  ).then((results) => {
    searchResponseCache.set(cacheKey, {
      expiresAt: Date.now() + SEARCH_RESPONSE_CACHE_TTL_MS,
      results,
    });
    inflightSearches.delete(cacheKey);
    return results;
  }).catch((error) => {
    inflightSearches.delete(cacheKey);
    throw error;
  });

  inflightSearches.set(cacheKey, work);
  return work;
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

    const results = await resolveSearchResultsWithCache({
      query,
      type: options.type,
      schoolSlug,
      surface,
      limit,
    });

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

    return NextResponse.json(
      { results },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=900",
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      },
    );
  } catch (err) {
    if (String(err).includes("bail out of prerendering")) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }
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
