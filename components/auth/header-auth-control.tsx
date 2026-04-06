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
    "hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm",
    "motion-reduce:transform-none motion-reduce:hover:shadow-none",
    isHome
      ? "bg-ivory !text-deep-ink hover:bg-white hover:ring-1 hover:ring-white/40"
      : "border border-border bg-white/80 !text-ink hover:border-teal/35 hover:bg-white hover:ring-1 hover:ring-teal/15",
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
