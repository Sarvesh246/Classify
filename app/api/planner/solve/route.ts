import { NextResponse } from "next/server";
import type { RankingMode } from "@/lib/types";
import { solvePlannerSelection } from "@/lib/planner";
import { rateLimitRequest } from "@/lib/rate-limit";
import { serverLog } from "@/lib/server-logger";

function normalizeRankingMode(value: string | null | undefined): RankingMode {
  if (
    value === "expected_gpa" ||
    value === "ease_score" ||
    value === "planner_fit"
  ) {
    return value;
  }
  return "planner_fit";
}

function normalizeCourseSlugs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export async function GET(request: Request) {
  try {
    const rateLimit = rateLimitRequest(request, {
      key: "planner_solve_get",
      limit: 45,
      windowMs: 60_000,
    });
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const url = new URL(request.url);
    const schoolSlug = url.searchParams.get("schoolSlug")?.trim();
    const courseSlugs = normalizeCourseSlugs(url.searchParams.get("courseSlugs"));
    const rankingMode = normalizeRankingMode(url.searchParams.get("rankingMode"));

    if (!schoolSlug || !courseSlugs.length) {
      serverLog.warn("planner_solve_invalid_request", {
        schoolSlug: schoolSlug ?? null,
        courseCount: courseSlugs.length,
      });
      return NextResponse.json(
        { error: "schoolSlug_and_courseSlugs_required" },
        { status: 400 },
      );
    }

    const result = await solvePlannerSelection({ schoolSlug, courseSlugs, rankingMode });
    if (!result) {
      serverLog.warn("planner_solve_school_not_found", {
        schoolSlug,
        courseCount: courseSlugs.length,
      });
      return NextResponse.json({ error: "school_not_found" }, { status: 404 });
    }

    if (result.warnings.length) {
      serverLog.info("planner_solve_completed_with_warnings", {
        schoolSlug,
        courseCount: courseSlugs.length,
        warningCount: result.warnings.length,
        rankingMode,
      });
    }

    return NextResponse.json(result, {
      headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
    });
  } catch (err) {
    serverLog.error("planner_solve_failed", { error: String(err) });
    return NextResponse.json({ error: "planner_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const rateLimit = rateLimitRequest(request, {
      key: "planner_solve_post",
      limit: 30,
      windowMs: 60_000,
    });
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    const payload = (await request.json().catch(() => null)) as
      | {
          schoolSlug?: string;
          courseSlugs?: string[] | string;
          rankingMode?: string;
        }
      | null;

    const schoolSlug = payload?.schoolSlug?.trim();
    const courseSlugs = normalizeCourseSlugs(payload?.courseSlugs);
    const rankingMode = normalizeRankingMode(payload?.rankingMode);

    if (!schoolSlug || !courseSlugs.length) {
      serverLog.warn("planner_solve_invalid_request", {
        schoolSlug: schoolSlug ?? null,
        courseCount: courseSlugs.length,
      });
      return NextResponse.json(
        { error: "schoolSlug_and_courseSlugs_required" },
        { status: 400 },
      );
    }

    const result = await solvePlannerSelection({ schoolSlug, courseSlugs, rankingMode });
    if (!result) {
      serverLog.warn("planner_solve_school_not_found", {
        schoolSlug,
        courseCount: courseSlugs.length,
      });
      return NextResponse.json({ error: "school_not_found" }, { status: 404 });
    }

    if (result.warnings.length) {
      serverLog.info("planner_solve_completed_with_warnings", {
        schoolSlug,
        courseCount: courseSlugs.length,
        warningCount: result.warnings.length,
        rankingMode,
      });
    }

    return NextResponse.json(result, {
      headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
    });
  } catch (err) {
    serverLog.error("planner_solve_failed", { error: String(err) });
    return NextResponse.json({ error: "planner_unavailable" }, { status: 503 });
  }
}
