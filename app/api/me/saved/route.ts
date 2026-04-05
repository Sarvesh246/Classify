import { NextResponse } from "next/server";
import { getServerSupabaseUser } from "@/lib/auth/server-supabase-user";
import { rateLimitRequest } from "@/lib/rate-limit";
import { createClient } from "@/utils/supabase/server";

function slugish(s: string) {
  return typeof s === "string" && s.length > 0 && s.length < 200 && !/[<>]/.test(s);
}

export async function GET(request: Request) {
  const rateLimit = rateLimitRequest(request, {
    key: "me_saved_get",
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_saved_items")
    .select("id, item_type, school_slug, professor_slug, course_slug, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}

export async function POST(request: Request) {
  const rateLimit = rateLimitRequest(request, {
    key: "me_saved_post",
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

  const b = body as Record<string, unknown>;
  const itemType = b.itemType;
  const schoolSlug = b.schoolSlug;

  if (itemType !== "professor" && itemType !== "course") {
    return NextResponse.json({ error: "itemType must be professor or course" }, { status: 400 });
  }
  if (typeof schoolSlug !== "string" || !slugish(schoolSlug)) {
    return NextResponse.json({ error: "Invalid schoolSlug" }, { status: 400 });
  }

  let row: {
    user_id: string;
    item_type: string;
    school_slug: string;
    professor_slug: string | null;
    course_slug: string | null;
  };

  if (itemType === "professor") {
    const professorSlug = b.professorSlug;
    if (typeof professorSlug !== "string" || !slugish(professorSlug)) {
      return NextResponse.json({ error: "Invalid professorSlug" }, { status: 400 });
    }
    row = {
      user_id: user.id,
      item_type: "professor",
      school_slug: schoolSlug,
      professor_slug: professorSlug,
      course_slug: null,
    };
  } else {
    const courseSlug = b.courseSlug;
    if (typeof courseSlug !== "string" || !slugish(courseSlug)) {
      return NextResponse.json({ error: "Invalid courseSlug" }, { status: 400 });
    }
    row = {
      user_id: user.id,
      item_type: "course",
      school_slug: schoolSlug,
      professor_slug: null,
      course_slug: courseSlug,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("user_saved_items").insert(row).select("id").single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, id: null, alreadySaved: true }, {
        headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}

export async function DELETE(request: Request) {
  const rateLimit = rateLimitRequest(request, {
    key: "me_saved_delete",
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
  if (!id || id.length > 100 || !/^[a-f0-9-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("user_saved_items").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}
