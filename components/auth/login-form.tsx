"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ClassifyLoadingMark } from "@/components/loading/classify-loading-mark";
import { EmailMagicLinkSection } from "@/components/auth/email-magic-link-section";
import { useCombinedAuth } from "@/components/auth/use-combined-auth";
import { useAppRuntime } from "@/hooks/use-app-runtime";
import { signInWithGoogle } from "@/lib/firebase/auth";
import { signOutAll } from "@/utils/supabase/sign-out";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const { user, hydrated: authReady } = useCombinedAuth();
  const { isStandalone } = useAppRuntime();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const verifyError =
    searchParams.get("error") === "verify"
      ? "That sign-in link expired or was already used. Request a fresh link below."
      : null;
  const error = actionError ?? verifyError;

  async function onGoogle() {
    setActionError(null);
    setBusy(true);
    const result = await signInWithGoogle();
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error);
    }
  }

  async function onSignOut() {
    setActionError(null);
    setBusy(true);
    await signOutAll();
    setBusy(false);
  }

  if (!authReady) {
    return (
      <div className="soft-panel flex min-h-[220px] flex-col items-center justify-center gap-6 rounded-[28px] px-8 py-12">
        <ClassifyLoadingMark size="md" tone="light" label="Loading sign-in options" />
        <p className="text-sm text-muted">One moment…</p>
      </div>
    );
  }

  if (user) {
    const methodLabel = user.source === "supabase" ? "Email link" : "Google";

    return (
      <div className="soft-panel rounded-[28px] px-8 py-10 sm:px-10 sm:py-12">
        <span className="inline-flex rounded-full bg-teal/12 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal">
          Signed in
        </span>
        <h2 className="display-title mt-4 text-2xl font-semibold text-ink sm:text-3xl">
          You&apos;re all set
        </h2>
        <p className="mt-2 text-base text-muted">
          Signed in as <span className="font-medium text-ink">{user.displayLabel}</span>
          {user.email && user.displayLabel !== user.email ? (
            <>
              <br />
              <span className="text-sm">{user.email}</span>
            </>
          ) : null}
        </p>
        <p className="mt-3 text-sm text-muted">
          <span className="rounded-md bg-background px-2 py-0.5 text-xs font-medium text-ink/80">
            {methodLabel}
          </span>
        </p>
        {user.source === "firebase" ? (
          <p className="mt-3 text-sm text-muted">
            Google sign-in currently keeps this browser signed in, but Classify cloud saves still
            use the email-link account flow. Use email sign-in if you want drafts, compare sets,
            and saved items to sync across devices.
          </p>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/profile"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-deep-ink px-6 text-sm font-semibold !text-ivory transition hover:opacity-92 sm:min-w-[10rem] sm:flex-none"
          >
            View profile
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-border-strong bg-surface-raised-top px-6 text-sm font-semibold text-ink transition hover:bg-surface-raised-top/90 sm:min-w-[10rem] sm:flex-none"
          >
            Go to home
          </Link>
          <Link
            href="/search"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-border-strong bg-surface-raised-top px-6 text-sm font-semibold text-ink transition hover:bg-surface-raised-top/90 sm:min-w-[10rem] sm:flex-none"
          >
            Open search
          </Link>
          <button
            type="button"
            onClick={() => void onSignOut()}
            disabled={busy}
            className="inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-medium text-muted underline-offset-4 transition hover:text-ink hover:underline disabled:opacity-50 sm:ml-1"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="soft-panel rounded-[28px] px-8 py-10 sm:px-10 sm:py-12">
      <h2 className="display-title text-2xl font-semibold text-ink sm:text-3xl">Sign in</h2>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted">
        {isStandalone
          ? "Use an email link for cloud saves in the installed app. Google remains available, but email is the sync-first path across devices."
          : "Use Google or get a one-time link by email. You can explore Classify without an account and sign in when you want a consistent profile across devices."}
      </p>

      {error ? (
        <div
          className="mt-6 rounded-2xl border border-copper/30 bg-copper/[0.08] px-4 py-3 text-sm text-ink"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-8 space-y-6">
        {isStandalone ? <EmailMagicLinkSection /> : null}

        <button
          type="button"
          onClick={() => void onGoogle()}
          disabled={busy}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-3 rounded-full border border-border/90 bg-white text-sm font-semibold text-slate-900 shadow-sm transition",
            "hover:border-teal/35 hover:shadow-md",
            "dark:border-white/18 dark:bg-white dark:text-slate-900",
            "disabled:cursor-not-allowed disabled:opacity-55",
          )}
        >
          <GoogleGMark className="h-5 w-5 shrink-0" aria-hidden />
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <span className="w-full border-t border-border/80" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[var(--surface-strong)] px-4 text-xs font-medium uppercase tracking-[0.14em] text-muted">
              {isStandalone ? "or use browser sign-in" : "or use email"}
            </span>
          </div>
        </div>

        {isStandalone ? null : <EmailMagicLinkSection />}
      </div>

      <p className="mt-10 border-t border-border/60 pt-8 text-center text-sm text-muted">
        <Link href="/" className="font-medium text-ink underline-offset-2 hover:underline">
          Back to home
        </Link>
        <span className="mx-2 text-border">·</span>
        <Link href="/search" className="font-medium text-ink underline-offset-2 hover:underline">
          Search
        </Link>
      </p>
    </div>
  );
}

function GoogleGMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
