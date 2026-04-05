import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { LoadingFallbackCompact } from "@/components/loading/loading-fallback";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Sign in",
  description: "Sign in to Classify with Google or email. Email-link sign-in unlocks cloud saves.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell flex justify-center pt-12 pb-20 sm:pt-16 sm:pb-24">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center sm:mb-10">
            <h1 className="app-page-title font-semibold text-ink">Welcome</h1>
            <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-muted">
              Sign in with Google for quick local access, or use email-link sign-in for cloud saves and planner sync.{" "}
              <Link href="/search" className="font-medium text-ink underline-offset-2 hover:underline">
                Browse without an account
              </Link>{" "}
              anytime.
            </p>
          </div>

          <Suspense
            fallback={
              <div className="rounded-[28px] border border-border/80 bg-white/80 px-4 py-6 sm:px-8">
                <LoadingFallbackCompact className="py-10" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
