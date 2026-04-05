"use client";

import Link from "next/link";
import { useCombinedAuth } from "@/components/auth/use-combined-auth";
import { cn } from "@/lib/utils";
import { signOutAll } from "@/utils/supabase/sign-out";

export function HeaderAuthControl({ isHome }: { isHome: boolean }) {
  const { user, hydrated: authReady } = useCombinedAuth();

  const loginClass = cn(
    "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ease-out",
    "hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm",
    "motion-reduce:transform-none motion-reduce:hover:shadow-none",
    isHome
      ? "bg-ivory !text-deep-ink hover:bg-white hover:ring-1 hover:ring-white/40"
      : "border border-border bg-white/80 !text-ink hover:border-teal/35 hover:bg-white hover:ring-1 hover:ring-teal/15",
  );

  if (!authReady) {
    return (
      <span className={cn(loginClass, "cursor-default opacity-70")} aria-hidden>
        …
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

  const short =
    user.email?.split("@")[0] || user.displayLabel.split(" ")[0] || "Account";

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "hidden max-w-[9rem] truncate text-sm font-medium sm:inline",
          isHome ? "text-ivory/92" : "text-ink",
        )}
        title={user.email ?? undefined}
      >
        {short}
      </span>
      <button
        type="button"
        onClick={() => void signOutAll()}
        className={cn(
          "rounded-full px-3 py-2 text-sm font-medium transition-all duration-200",
          isHome
            ? "text-ivory/90 underline-offset-4 hover:text-white hover:underline"
            : "text-muted underline-offset-4 hover:text-ink hover:underline",
        )}
      >
        Sign out
      </button>
    </div>
  );
}
