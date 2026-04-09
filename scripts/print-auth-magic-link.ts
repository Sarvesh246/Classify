/**
 * Disposable auth handoff helper for local or staging verification.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from .env.local).
 * Creates (or reuses) a confirmed user, then prints a Supabase magic-link URL that
 * completes through the same PKCE path as production: /auth/callback?code=…
 *
 * Usage:
 *   npx tsx scripts/print-auth-magic-link.ts [email] [origin]
 *   AUTH_VERIFY_ORIGIN=http://localhost:3200 npx tsx scripts/print-auth-magic-link.ts
 *
 * Open the printed URL in a browser while `next dev` or `next start` is running at `origin`.
 * Then verify /saved, POST /api/me/saved, compare-sets, planner-drafts, and the signed-in UI.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const base =
  process.argv[3]?.trim() ||
  process.env.AUTH_VERIFY_ORIGIN?.trim() ||
  "http://localhost:3000";

const emailArg = process.argv[2]?.trim();

async function main() {
  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (e.g. from .env.local).",
    );
    process.exit(1);
  }

  const email =
    emailArg || `classify-auth-smoke-${Date.now()}@users.noreply.classify.local`;

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (
    createErr &&
    !/already|registered|exists/i.test(String(createErr.message ?? ""))
  ) {
    console.error("createUser:", createErr.message);
    process.exit(1);
  }

  const origin = base.replace(/\/$/, "");
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/saved")}`;

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error) {
    console.error("generateLink:", error.message);
    process.exit(1);
  }

  const actionLink = data?.properties?.action_link;
  console.log("Email:", email);
  console.log("Redirect after session:", redirectTo);
  console.log("");
  if (actionLink) {
    console.log("Open this URL in your browser (app must be running at the same origin):\n");
    console.log(actionLink);
  } else {
    console.log("Unexpected response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

void main();
