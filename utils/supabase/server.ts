import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicUrlAndKey } from "@/utils/supabase/public-env";

export async function createClient() {
  const config = getSupabasePublicUrlAndKey();
  if (!config) {
    throw new Error(
      "Supabase server client: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "(or legacy NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY). Required for auth and /api/me/*.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component; middleware keeps sessions fresh.
        }
      },
    },
  });
}
