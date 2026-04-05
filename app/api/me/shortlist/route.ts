import { NextResponse } from "next/server";
import { getServerSupabaseUser } from "@/lib/auth/server-supabase-user";
import { rateLimitRequest } from "@/lib/rate-limit";
import { createClient } from "@/utils/supabase/server";

function slugish(s: string) {
  return typeof s === "string" && s.length > 0 && s.length < 200 && !/[<>]/.test(s);
}

export async function GET(request: Request) {
  const rateLimit = rateLimitRequest(request, {
    key: "me_shortlist_get",
    limit: 90,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  const user = await getServerSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolSlug = new URL(request.url).searchParams.get("schoolSlug") ?? "";
  if (!slugish(schoolSlug)) {
    return NextResponse.json({ error: "Invalid schoolSlug" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_course_shortlists")
    .select("course_slugs, updated_at")
    .eq("user_id", user.id)
    .eq("school_slug", schoolSlug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    courseSlugs: data?.course_slugs ?? [],
    updatedAt: data?.updated_at ?? null,
  }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}

export async function PUT(request: Request) {
  const rateLimit = rateLimitRequest(request, {
    key: "me_shortlist_put",
    limit: 48,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  const user = await getServerSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("schoolSlug" in body) ||
    !("courseSlugs" in body)
  ) {
    return NextResponse.json({ error: "Expected schoolSlug and courseSlugs" }, { status: 400 });
  }

  const schoolSlug = (body as { schoolSlug: unknown }).schoolSlug;
  const courseSlugs = (body as { courseSlugs: unknown }).courseSlugs;

  if (typeof schoolSlug !== "string" || !slugish(schoolSlug)) {
    return NextResponse.json({ error: "Invalid schoolSlug" }, { status: 400 });
  }

  if (!Array.isArray(courseSlugs) || courseSlugs.some((x) => typeof x !== "string" || !slugish(x))) {
    return NextResponse.json({ error: "Invalid courseSlugs" }, { status: 400 });
  }

  const unique = [...new Set(courseSlugs as string[])].slice(0, 200);

  const supabase = await createClient();
  const { error } = await supabase.from("user_course_shortlists").upsert(
    {
      user_id: user.id,
      school_slug: schoolSlug,
      course_slugs: unique,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,school_slug" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, courseSlugs: unique }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}
