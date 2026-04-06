"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClassifyLoadingMark } from "@/components/loading/classify-loading-mark";
import { useCombinedAuth } from "@/components/auth/use-combined-auth";
import { signOutAll } from "@/utils/supabase/sign-out";
import { cn } from "@/lib/utils";

export function ProfileClient() {
  const router = useRouter();
  const { user, hydrated } = useCombinedAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    await signOutAll();
    setSigningOut(false);
    router.push("/");
    router.refresh();
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-[28px] border border-border/80 bg-gradient-to-b from-white to-[var(--surface-strong)] px-8 py-12 shadow-[var(--shadow)]">
        <ClassifyLoadingMark size="md" tone="light" label="Loading profile" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-[28px] border border-border/80 bg-gradient-to-b from-white to-[var(--surface-strong)] px-8 py-10 shadow-[var(--shadow)]">
        <p className="text-base text-muted">You&apos;re not signed in.</p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-deep-ink px-6 text-sm font-semibold !text-ivory transition hover:opacity-92"
        >
          Log in
        </Link>
      </div>
    );
  }

  const methodLabel = user.source === "supabase" ? "Email link (Supabase)" : "Google";

  return (
    <div className="rounded-[28px] border border-border/80 bg-gradient-to-b from-white to-[var(--surface-strong)] px-8 py-10 shadow-[var(--shadow)] sm:px-10">
      <div className="flex flex-col gap-1 border-b border-border/60 pb-6">
        <p className="text-sm font-medium text-muted">Name</p>
        <p className="text-xl font-semibold text-ink">{user.firstName}</p>
        {user.displayLabel !== user.firstName ? (
          <p className="text-sm text-muted">{user.displayLabel}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 border-b border-border/60 py-6">
        <p className="text-sm font-medium text-muted">Email</p>
        <p className="text-base text-ink">{user.email ?? "—"}</p>
      </div>

      <div className="flex flex-col gap-1 py-6">
        <p className="text-sm font-medium text-muted">Sign-in method</p>
        <p className="text-base text-ink">{methodLabel}</p>
        {user.source === "firebase" ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Google keeps you signed in locally. For cloud saves across devices, also sign in with{" "}
            <strong className="font-medium text-ink">email link</strong> from the log in page.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
        <Link
          href="/saved"
          className={cn(
            "inline-flex h-12 flex-1 items-center justify-center rounded-full border border-border bg-white px-6 text-sm font-semibold text-ink transition hover:bg-white/90 sm:min-w-[8rem]",
          )}
        >
          Saved
        </Link>
        <Link
          href="/compare"
          className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-border bg-white px-6 text-sm font-semibold text-ink transition hover:bg-white/90 sm:min-w-[8rem]"
        >
          Compare
        </Link>
        <button
          type="button"
          disabled={signingOut}
          onClick={() => void onSignOut()}
          className="inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-medium text-muted underline-offset-4 transition hover:text-ink hover:underline disabled:opacity-50 sm:ml-auto"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
