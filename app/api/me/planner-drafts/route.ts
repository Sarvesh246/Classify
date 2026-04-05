import { NextResponse } from "next/server";
import { getServerSupabaseUser } from "@/lib/auth/server-supabase-user";
import { rateLimitRequest } from "@/lib/rate-limit";
import type { RankingMode } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

function slugish(s: string) {
  return typeof s === "string" && s.length > 0 && s.length < 200 && !/[<>]/.test(s);
}

function normalizeRankingMode(value: unknown): RankingMode {
  return value === "expected_gpa" || value === "ease_score" || value === "planner_fit"
    ? value
    : "planner_fit";
}

export async function GET(request: Request) {
  const rateLimit = rateLimitRequest(request, {
    key: "me_planner_drafts_get",
    limit: 60,
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
    .from("user_planner_drafts")
    .select("id, name, school_slug, term_label, course_slugs, ranking_mode, updated_at, created_at")
    .eq("user_id", user.id)
    .eq("school_slug", schoolSlug)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ drafts: data ?? [] }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}

export async function POST(request: Request) {
  const rateLimit = rateLimitRequest(request, {
    key: "me_planner_drafts_post",
    limit: 24,
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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const schoolSlug = payload.schoolSlug;
  const courseSlugs = payload.courseSlugs;
  const name =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim().slice(0, 120)
      : `Planner ${new Date().toLocaleDateString()}`;
  const termLabel =
    typeof payload.termLabel === "string" && payload.termLabel.trim()
      ? payload.termLabel.trim().slice(0, 64)
      : null;

  if (typeof schoolSlug !== "string" || !slugish(schoolSlug)) {
    return NextResponse.json({ error: "Invalid schoolSlug" }, { status: 400 });
  }

  if (!Array.isArray(courseSlugs) || courseSlugs.some((item) => typeof item !== "string" || !slugish(item))) {
    return NextResponse.json({ error: "Invalid courseSlugs" }, { status: 400 });
  }

  const uniqueCourseSlugs = [...new Set(courseSlugs)].slice(0, 24);
  if (!uniqueCourseSlugs.length) {
    return NextResponse.json({ error: "No valid course slugs" }, { status: 400 });
  }

  const rankingMode = normalizeRankingMode(payload.rankingMode);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_planner_drafts")
    .insert({
      user_id: user.id,
      name,
      school_slug: schoolSlug,
      term_label: termLabel,
      course_slugs: uniqueCourseSlugs,
      ranking_mode: rankingMode,
      updated_at: new Date().toISOString(),
    })
    .select("id, name, school_slug, term_label, course_slugs, ranking_mode, updated_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ draft: data }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}

export async function DELETE(request: Request) {
  const rateLimit = rateLimitRequest(request, {
    key: "me_planner_drafts_delete",
    limit: 24,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  const user = await getServerSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_planner_drafts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}
