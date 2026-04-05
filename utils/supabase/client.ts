import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicUrlAndKey } from "@/utils/supabase/public-env";

export function createClient() {
  const config = getSupabasePublicUrlAndKey();
  if (!config) {
    throw new Error(
      "Supabase browser client: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "(Dashboard → Settings → API → Project URL + anon public key). On Vercel: Project Settings → Environment Variables. " +
        "Legacy name NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY is still read if anon key is unset.",
    );
  }
  return createBrowserClient(config.url, config.anonKey);
}
