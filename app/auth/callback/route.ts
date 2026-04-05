import { NextResponse } from "next/server";
import { safeReturnPath } from "@/lib/safe-return-path";
import { createClient } from "@/utils/supabase/server";

/**
 * Handles Supabase Auth redirects (PKCE) after magic link / OAuth — exchanges `?code=` for a session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeReturnPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
