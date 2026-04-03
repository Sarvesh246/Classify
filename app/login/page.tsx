import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Log in",
  description: "Sign-in placeholder—configure Supabase and Google auth next.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10 pb-16">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <p className="eyebrow">Authentication</p>
          <h1 className="app-page-title mt-3 font-semibold text-ink">Log in (coming soon)</h1>
          <p className="app-lead mt-4">
            This page is a shell for real sign-in. The UI is wired from the header; what&apos;s left
            is backend configuration and a small amount of app code to call the auth client.
          </p>

          <div className="mt-8 rounded-[26px] border border-border/70 bg-white/72 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-ink">Configure next</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted">
              <li>
                <strong className="text-ink">Supabase</strong> — Create a project, enable Auth, and add
                environment variables (e.g. <code className="rounded bg-background px-1">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
                <code className="rounded bg-background px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>).
              </li>
              <li>
                <strong className="text-ink">Google sign-in</strong> — In{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  className="text-ink underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Cloud Console
                </a>
                , create an OAuth 2.0 client (Web), then in Supabase Dashboard go to{" "}
                <strong className="text-ink">Authentication → Providers → Google</strong> and paste the
                client ID and secret. (Same Google Cloud project can back multiple products; linking
                from{" "}
                <a
                  href="https://aistudio.google.com/"
                  className="text-ink underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google AI Studio
                </a>{" "}
                or other tools is separate from OAuth credentials.)
              </li>
              <li>
                <strong className="text-ink">Firebase (optional)</strong> — If you prefer Firebase Auth
                instead of Supabase&apos;s built-in Auth, use the Firebase console to enable Google
                sign-in, then either bridge identities to Supabase or use Firebase as the only auth
                layer and validate sessions in your API routes.
              </li>
              <li>
                <strong className="text-ink">App code</strong> — Install{" "}
                <code className="rounded bg-background px-1">@supabase/ssr</code> (or your chosen
                stack), add a server/client Supabase helper, middleware for protected routes, and
                replace this page with your sign-in form or hosted OAuth redirect.
              </li>
            </ol>
          </div>

          <p className="mt-8 text-sm text-muted">
            Until auth is live, the rest of the site works without an account.{" "}
            <Link href="/" className="font-medium text-ink underline underline-offset-2">
              Back to home
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
