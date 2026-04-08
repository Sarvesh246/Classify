"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { ClassifyLogo } from "@/components/classify-logo";
import { HeaderAuthControl } from "@/components/auth/header-auth-control";
import { HeaderBackButton } from "@/components/header-back-button";
import { getRouteShellMeta } from "@/lib/route-shell-meta";
import { cn } from "@/lib/utils";

export function MobileRouteBar({ tone = "app" }: { tone?: "home" | "app" }) {
  const pathname = usePathname();
  const meta = getRouteShellMeta(pathname);
  const actionIcon =
    meta.actionIcon === "filters" ? (
      <SlidersHorizontal className="h-4 w-4" />
    ) : (
      <Search className="h-4 w-4" />
    );

  return (
    <div
      className={cn(
        "safe-top-pad sticky top-0 z-[62] border-b px-3 pb-3 pt-2 backdrop-blur-2xl md:hidden",
        tone === "home"
          ? "border-white/10 bg-deep-ink/52 text-ivory"
          : "border-border/70 bg-background/86 text-ink",
      )}
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            {meta.kind === "deep" ? (
              <HeaderBackButton tone={tone === "home" ? "home" : "app"} />
            ) : (
              <Link href="/" className="shrink-0" aria-label="Classify home">
                <ClassifyLogo compact />
              </Link>
            )}
            <div className="min-w-0">
              <p className="truncate text-[0.95rem] font-semibold">{meta.title}</p>
              <p
                className={cn(
                  "truncate text-xs",
                  tone === "home" ? "text-ivory/68" : "text-muted",
                )}
              >
                {meta.subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {meta.actionHref ? (
            <Link
              href={meta.actionHref}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-medium",
                tone === "home"
                  ? "border border-white/15 bg-white/10 text-ivory"
                  : "border border-border bg-white/78 text-ink",
              )}
            >
              {actionIcon}
              <span className="max-[390px]:hidden">{meta.actionLabel}</span>
            </Link>
          ) : null}
          <HeaderAuthControl isHome={tone === "home"} compact />
        </div>
      </div>
    </div>
  );
}
