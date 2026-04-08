"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { HeaderAuthControl } from "@/components/auth/header-auth-control";
import { ClassifyLogo } from "@/components/classify-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NavSavedLink } from "@/components/nav-saved-link";
import { cn } from "@/lib/utils";

interface SiteHeaderInnerProps {
  tone?: "home" | "app";
  backSlot: ReactNode;
}

const navLinkClassName = cn(
  "group relative inline-flex min-h-11 items-center py-2 transition-colors duration-200 ease-out",
  "hover:text-teal focus-visible:text-teal",
  "after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-teal after:transition-transform after:duration-200 after:ease-out",
  "motion-reduce:after:transition-none motion-reduce:transition-none",
  "hover:after:scale-x-100 focus-visible:after:scale-x-100",
);

export function SiteHeaderInner({ tone = "app", backSlot }: SiteHeaderInnerProps) {
  const isHome = tone === "home";

  return (
    <header
      className={cn(
        "safe-top-pad sticky top-0 z-[60] hidden border-b backdrop-blur-xl md:block",
        isHome
          ? "border-white/10 bg-deep-ink/34 text-ivory"
          : "border-border-strong bg-surface-strong/95 text-ink shadow-[0_10px_36px_rgba(7,17,31,0.07)] dark:shadow-[0_10px_36px_rgba(0,0,0,0.35)]",
      )}
    >
      <div className="section-shell flex min-h-18 items-center justify-between gap-4 py-3 md:py-4">
        <div className="flex min-w-0 items-center gap-3">
          {backSlot}
          <Link href="/" aria-label="Classify home" className="shrink-0">
            <ClassifyLogo />
          </Link>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
          <Link href="/search" className={navLinkClassName}>
            Search
          </Link>
          <Link href="/compare" className={navLinkClassName}>
            Compare
          </Link>
          <NavSavedLink className={navLinkClassName} />
          <Link href="/methodology" className={navLinkClassName}>
            Methodology
          </Link>
          <Link href="/search?type=school" className={navLinkClassName}>
            Schools
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle tone={isHome ? "home" : "app"} />
          <Link
            href="/search"
            className={cn(
              "hidden min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ease-out sm:inline-flex",
              "hover:-translate-y-px active:translate-y-0",
              "motion-reduce:transform-none",
              isHome
                ? "glass-line text-ivory hover:bg-white/18 hover:ring-1 hover:ring-white/25"
                : "border border-border bg-surface-strong/85 shadow-classify-pill hover:border-teal/40 hover:bg-surface-raised-top hover:shadow-classify-pill-hover hover:ring-1 hover:ring-teal/20 active:shadow-classify-pill dark:bg-surface-raised-bottom/80 dark:hover:bg-white/10 motion-reduce:hover:shadow-classify-pill",
            )}
          >
            <Search className="h-4 w-4" />
            Search
          </Link>
          <HeaderAuthControl isHome={isHome} />
        </div>
      </div>
    </header>
  );
}
