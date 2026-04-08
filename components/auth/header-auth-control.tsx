"use client";

import Link from "next/link";
import { useCombinedAuth } from "@/components/auth/use-combined-auth";
import { UserAccountMenu } from "@/components/auth/user-account-menu";
import { cn } from "@/lib/utils";

export function HeaderAuthControl({
  isHome,
  compact = false,
}: {
  isHome: boolean;
  compact?: boolean;
}) {
  const { user, hydrated: authReady } = useCombinedAuth();

  const loginClass = cn(
    "inline-flex items-center rounded-full text-sm font-medium transition-all duration-200 ease-out",
    compact ? "min-h-11 px-3.5 py-2" : "px-4 py-2",
    "hover:-translate-y-px active:translate-y-0",
    "motion-reduce:transform-none",
    isHome
      ? "bg-ivory !text-deep-ink hover:bg-white hover:ring-1 hover:ring-white/40"
      : "border border-border bg-surface-strong/92 !text-ink shadow-classify-pill hover:border-teal/35 hover:bg-surface-raised-top hover:shadow-classify-pill-hover hover:ring-1 hover:ring-teal/15 active:shadow-classify-pill dark:hover:bg-white/10 motion-reduce:hover:shadow-classify-pill",
  );

  if (!authReady) {
    return (
      <span
        className={cn(loginClass, "cursor-default opacity-70")}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        Loading...
      </span>
    );
  }

  if (!user) {
    return (
      <Link href="/login" className={loginClass}>
        Log in
      </Link>
    );
  }

  return (
    <UserAccountMenu firstName={user.firstName} isHome={isHome} compact={compact} />
  );
}
