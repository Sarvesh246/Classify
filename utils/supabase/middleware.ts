import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicUrlAndKey } from "@/utils/supabase/public-env";

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(({ name }) => name.includes("sb-") && name.includes("auth-token"));
}

/**
 * Refreshes the Supabase auth session and forwards cookies on the response.
 * Call this from root `middleware.ts`.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const config = getSupabasePublicUrlAndKey();
  if (!config) {
    return supabaseResponse;
  }

  // No auth cookie present: skip refresh to keep anonymous requests fast.
  if (!hasSupabaseAuthCookie(request)) {
    return supabaseResponse;
  }

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Triggers refresh; keep this immediately after createServerClient (Supabase guidance).
  await supabase.auth.getUser();

  return supabaseResponse;
}
