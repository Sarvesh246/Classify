import { NextResponse } from "next/server";
import { getPlannerSectionSlice } from "@/lib/planner";
import { rateLimitRequest } from "@/lib/rate-limit";

function normalizeCourseSlugs(searchParams: URLSearchParams) {
  const values = [
    ...searchParams.getAll("courseSlug"),
    ...searchParams.getAll("courseSlugs").flatMap((value) => value.split(",")),
  ];

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/schools/[slug]/sections">,
) {
  const rateLimit = rateLimitRequest(request, {
    key: "planner_sections",
    limit: 90,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { slug } = await ctx.params;
  const url = new URL(request.url);
  const courseSlugs = normalizeCourseSlugs(url.searchParams);
  const snapshot = await getPlannerSectionSlice(slug, courseSlugs);

  if (!snapshot) {
    return NextResponse.json(
      { error: "school_not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    school: snapshot.school,
    supportProfile: snapshot.supportProfile,
    updatedAt: snapshot.updatedAt,
    courseSlugs: snapshot.courseSlugs,
    sections: snapshot.sections,
    sectionCount: snapshot.sectionCount,
  }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}
