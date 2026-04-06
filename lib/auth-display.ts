import type { User as FirebaseUser } from "firebase/auth";
import type { User as SupabaseUser } from "@supabase/supabase-js";

/** First token of a display name, or null if unusable. */
function firstToken(value: string | null | undefined): string | null {
  const t = value?.trim();
  if (!t) return null;
  const word = t.split(/\s+/)[0];
  return word || null;
}

export function firstNameFromSupabaseUser(user: SupabaseUser): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  if (meta) {
    for (const key of ["given_name", "first_name"] as const) {
      const v = meta[key];
      if (typeof v === "string" && v.trim()) {
        const tok = firstToken(v);
        if (tok) return tok;
      }
    }
    for (const key of ["full_name", "name"] as const) {
      const v = meta[key];
      if (typeof v === "string" && v.trim()) {
        const tok = firstToken(v);
        if (tok) return tok;
      }
    }
  }
  const fromEmail = firstToken(user.email?.split("@")[0]);
  if (fromEmail) return fromEmail;
  return "You";
}

export function firstNameFromFirebaseUser(user: FirebaseUser): string {
  const fromName = firstToken(user.displayName);
  if (fromName) return fromName;
  const fromEmail = firstToken(user.email?.split("@")[0]);
  if (fromEmail) return fromEmail;
  return "You";
}
