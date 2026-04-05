import "server-only";

import { createClient } from "@/utils/supabase/server";

/**
 * Canonical identity for server-side APIs, RLS, and cloud sync.
 * Only Supabase Auth sets cookies that `createClient()` reads; Firebase Google sign-in
 * alone does not populate these. Cloud features require a Supabase session (e.g. email magic link).
 */
export async function getServerSupabaseUser(): Promise<{
  id: string;
  email: string | undefined;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { id: user.id, email: user.email ?? undefined };
}
