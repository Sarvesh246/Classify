import { NextResponse } from "next/server";
import { getServerSupabaseUser } from "@/lib/auth/server-supabase-user";
import { rateLimitRequest } from "@/lib/rate-limit";
import { createClient } from "@/utils/supabase/server";

function validId(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length < 256 && !/[<>]/.test(s);
}

function isUuidParam(s: string) {
  return /^[a-f0-9-]{36}$/i.test(s);
}

export async function GET(request: Request) {
  const rateLimit = rateLimitRequest(request, {
    key: "me_compare_sets_get",
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
    .from("user_compare_sets")
    .select("id, name, offering_ids, school_slug, updated_at, created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sets: data ?? [] }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}

export async function POST(request: Request) {
  const rateLimit = rateLimitRequest(request, {
    key: "me_compare_sets_post",
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

  if (typeof body !== "object" || body === null || !("offeringIds" in body)) {
    return NextResponse.json({ error: "Expected offeringIds" }, { status: 400 });
  }

  const offeringIdsRaw = (body as { offeringIds: unknown }).offeringIds;
  if (!Array.isArray(offeringIdsRaw) || offeringIdsRaw.length === 0) {
    return NextResponse.json({ error: "offeringIds must be a non-empty array" }, { status: 400 });
  }

  const offeringIds = offeringIdsRaw.slice(0, 4).filter(validId);
  if (offeringIds.length === 0) {
    return NextResponse.json({ error: "No valid offering ids" }, { status: 400 });
  }

  const name =
    "name" in body && typeof (body as { name: unknown }).name === "string"
      ? (body as { name: string }).name.slice(0, 120)
      : null;

  const schoolSlug =
    "schoolSlug" in body && typeof (body as { schoolSlug: unknown }).schoolSlug === "string"
      ? (body as { schoolSlug: string }).schoolSlug.slice(0, 200)
      : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_compare_sets")
    .insert({
      user_id: user.id,
      name: name || `Compare ${new Date().toLocaleDateString()}`,
      offering_ids: offeringIds,
      school_slug: schoolSlug,
    })
    .select("id, name, offering_ids, school_slug, updated_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ set: data }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}

export async function DELETE(request: Request) {
  const rateLimit = rateLimitRequest(request, {
    key: "me_compare_sets_delete",
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
  if (!id || !isUuidParam(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("user_compare_sets").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, {
    headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) },
  });
}
