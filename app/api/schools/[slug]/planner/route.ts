import { NextResponse } from "next/server";
import { getPlannerSnapshotResponse } from "@/lib/planner";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/schools/[slug]/planner">,
) {
  const rateLimit = rateLimitRequest(request, {
    key: "planner_snapshot",
    limit: 120,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { slug } = await ctx.params;
  const snapshot = await getPlannerSnapshotResponse(slug);

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
    catalogPreview: snapshot.catalogPreview,
    sectionPreviewCount: snapshot.sectionPreviewCount,
    courseCount: snapshot.courseCount,
    instructorCount: snapshot.instructorCount,
  }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}
