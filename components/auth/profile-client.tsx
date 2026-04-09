"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Home,
  LogOut,
  Mail,
  Scale,
  Search,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
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
      <div className="soft-panel flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[28px] px-6 py-12 sm:min-h-[240px] sm:px-8 sm:py-14">
        <ClassifyLoadingMark size="md" tone="light" label="Loading profile" />
        <p className="text-center text-sm text-muted">Loading your account…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-6">
        <div className="soft-panel relative overflow-hidden rounded-[28px] p-6 sm:p-8 lg:rounded-[32px]">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 12% 18%, rgba(88, 199, 184, 0.22), transparent 55%), radial-gradient(ellipse 70% 50% at 88% 82%, rgba(201, 138, 87, 0.14), transparent 50%)",
            }}
          />
          <div className="relative text-center sm:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface-strong/90 px-3 py-1 text-xs font-medium text-muted">
              <Sparkles className="h-3.5 w-3.5 text-teal" aria-hidden />
              Classify account
            </span>
            <h2 className="display-title mt-4 text-2xl font-semibold text-ink sm:mt-5 sm:text-3xl lg:text-4xl">
              Sign in to sync saves &amp; planner
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted sm:mx-0">
              Use email sign-in for cloud saves across devices. You can still browse search and
              compare without an account.
            </p>
            <div className="mt-6 flex justify-center sm:justify-start sm:mt-8">
              <Link
                href="/login"
                className="inline-flex min-h-12 w-full max-w-[20rem] items-center justify-center gap-2 rounded-full bg-deep-ink px-6 text-sm font-semibold !text-ivory shadow-classify-pill transition hover:opacity-92 sm:w-auto sm:max-w-none sm:px-8"
              >
                Log in or create account
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">
              <Link href="/search" className="font-medium text-ink underline-offset-2 hover:underline">
                Continue browsing without signing in
              </Link>
            </p>
            <p className="mt-4 text-sm text-muted">
              <Link href="/settings" className="font-medium text-ink underline-offset-2 hover:underline">
                Settings — appearance, search history, and device options
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const methodLabel = user.source === "supabase" ? "Email link" : "Google";
  const methodDescription =
    user.source === "supabase"
      ? "Signed in with a one-time email link. Your saves sync across devices."
      : "Signed in with Google in this browser. Add email sign-in for cloud sync everywhere.";

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="soft-panel overflow-hidden rounded-[28px] sm:rounded-[32px]">
        <div className="border-b border-border/60 bg-gradient-to-br from-teal/[0.07] via-transparent to-copper/[0.06] px-5 py-7 sm:px-8 sm:py-9 lg:px-10 dark:from-teal/10 dark:to-copper/5">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left lg:gap-10">
            <ProfileAvatar label={user.displayLabel} firstName={user.firstName} />
            <div className="min-w-0 w-full flex-1 sm:w-auto">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Signed in as</p>
              <h2 className="display-title mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:mt-2 sm:text-3xl lg:text-4xl">
                {user.firstName}
              </h2>
              {user.displayLabel !== user.firstName ? (
                <p className="mt-1 text-base text-muted">{user.displayLabel}</p>
              ) : null}
              {user.email ? (
                <p className="mt-3 flex items-start justify-center gap-2 text-sm sm:justify-start">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal/90" aria-hidden />
                  <span className="min-w-0 max-w-full text-left break-all text-ink/90">{user.email}</span>
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                    user.source === "supabase"
                      ? "border-teal/35 bg-teal/10 text-teal"
                      : "border-border-strong bg-surface-raised-top text-ink",
                  )}
                >
                  {user.source === "supabase" ? (
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <UserRound className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {methodLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-8 lg:px-10">
          <p className="text-sm leading-relaxed text-muted">{methodDescription}</p>
          {user.source === "firebase" ? (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              For cloud saves across devices, also sign in with{" "}
              <strong className="font-medium text-ink">email link</strong> from the{" "}
              <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
                log in page
              </Link>
              .
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="profile-workspace-heading">
        <h3 id="profile-workspace-heading" className="sr-only">
          Your workspace
        </h3>
        <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.18em] text-muted sm:mb-3">
          Jump back in
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <WorkspaceLink
            href="/"
            icon={Home}
            title="Home"
            description="Hero search & coverage"
          />
          <WorkspaceLink
            href="/search"
            icon={Search}
            title="Search"
            description="Schools, courses, professors"
          />
          <WorkspaceLink
            href="/saved"
            icon={Bookmark}
            title="Saved"
            description="Library & lists"
          />
          <WorkspaceLink
            href="/compare"
            icon={Scale}
            title="Compare"
            description="Side-by-side picks"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <section className="rounded-[28px] classify-inner p-6 sm:p-7" aria-labelledby="account-details-heading">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 shrink-0 text-teal" aria-hidden />
            <h3 id="account-details-heading" className="text-lg font-semibold text-ink">
              Account details
            </h3>
          </div>
          <dl className="mt-5 space-y-4 sm:mt-6 sm:space-y-5">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Display name</dt>
              <dd className="mt-1 text-base font-medium text-ink">{user.firstName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Email</dt>
              <dd className="mt-1 break-all text-base text-ink">{user.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Sign-in method</dt>
              <dd className="mt-1 text-base text-ink">{methodLabel}</dd>
            </div>
          </dl>
        </section>

        <Link
          href="/settings"
          className="flex h-full flex-col rounded-[28px] border border-border/80 bg-surface-strong/50 p-6 transition hover:border-teal/35 hover:bg-surface-raised-top hover:shadow-classify-pill sm:p-7 dark:bg-surface-raised-bottom/40 dark:hover:bg-white/5"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-deep-ink text-ivory">
              <Settings className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-ink">Settings</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Default theme, recent search history, local planner cache, and methodology.
              </p>
            </div>
          </div>
          <span className="mt-4 text-sm font-semibold text-teal">Open settings →</span>
        </Link>
      </div>

      <section
        className="rounded-[28px] border border-border/80 bg-surface-well/40 p-6 sm:p-7 dark:bg-surface-well/30"
        aria-labelledby="session-heading"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h3 id="session-heading" className="flex items-center gap-2 text-lg font-semibold text-ink">
              <LogOut className="h-5 w-5 shrink-0 text-muted" aria-hidden />
              Session
            </h3>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
              Sign out on this device. Your saved data stays in your account when you use email
              sign-in.
            </p>
          </div>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void onSignOut()}
            className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface-strong px-6 text-sm font-semibold text-ink transition hover:border-copper/40 hover:bg-copper/5 disabled:opacity-50 sm:w-auto dark:hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ProfileAvatar({ firstName, label }: { firstName: string; label: string }) {
  const initials = getInitials(label || firstName);
  return (
    <div
      className="relative flex h-[5.25rem] w-[5.25rem] shrink-0 items-center justify-center rounded-[22px] border border-border-strong bg-gradient-to-br from-teal/20 via-surface-strong to-copper/15 text-[1.65rem] font-semibold tracking-tight text-ink shadow-classify-card sm:h-24 sm:w-24 sm:text-[1.85rem] dark:from-teal/25 dark:via-surface-strong dark:to-deep-ink/40"
      aria-hidden
    >
      {initials}
    </div>
  );
}

function getInitials(source: string): string {
  const t = source.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0];
    const b = parts[parts.length - 1][0];
    if (a && b) return (a + b).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

function WorkspaceLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Home;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col gap-2.5 rounded-[20px] border border-border/80 bg-surface-strong/60 p-3.5 text-left transition hover:border-teal/35 hover:bg-surface-raised-top hover:shadow-classify-pill sm:gap-3 sm:rounded-[22px] sm:p-4 dark:bg-surface-raised-bottom/50 dark:hover:bg-white/5"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-deep-ink text-ivory shadow-sm group-hover:bg-teal group-hover:text-deep-ink sm:h-10 sm:w-10 sm:rounded-2xl dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight text-ink sm:text-base">{title}</span>
        <span className="mt-0.5 block text-[0.7rem] leading-snug text-muted sm:text-xs">{description}</span>
      </span>
    </Link>
  );
}

