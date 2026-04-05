"use client";

import { useCombinedAuth } from "@/components/auth/use-combined-auth";
import { SavedHub } from "@/components/saved/saved-hub";

/** Remount hub when Supabase user changes so list state does not leak across accounts. */
export function SavedHubShell() {
  const { supabaseUserId } = useCombinedAuth();
  return <SavedHub key={supabaseUserId ?? "anon"} />;
}
