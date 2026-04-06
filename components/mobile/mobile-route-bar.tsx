"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Search, SlidersHorizontal } from "lucide-react";
import { ClassifyLogo } from "@/components/classify-logo";
import { HeaderAuthControl } from "@/components/auth/header-auth-control";
import { cn } from "@/lib/utils";

type RouteMeta = {
  kind: "tab" | "deep";
  title: string;
  subtitle: string;
  backHref?: string;
  actionHref?: string;
  actionLabel?: string;
  actionIcon?: "search" | "filters";
};

function schoolRootFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "schools" && parts[1]) {
    return `/schools/${parts[1]}`;
  }
  return "/search";
}

function getRouteMeta(pathname: string): RouteMeta {
  if (pathname === "/") {
    return {
      kind: "tab",
      title: "Home",
      subtitle: "Launch your next decision fast.",
      actionHref: "/search",
      actionLabel: "Search",
      actionIcon: "search",
    };
  }

  if (pathname === "/search") {
    return {
      kind: "tab",
      title: "Search",
      subtitle: "Schools, courses, and professors together.",
      actionHref: "/compare",
      actionLabel: "Compare",
      actionIcon: "filters",
    };
  }

  if (pathname === "/compare") {
    return {
      kind: "tab",
      title: "Compare",
      subtitle: "Build a smarter shortlist.",
      actionHref: "/search",
      actionLabel: "Add",
      actionIcon: "search",
    };
  }

  if (pathname === "/saved") {
    return {
      kind: "tab",
      title: "Saved",
      subtitle: "Your academic workspace.",
      actionHref: "/search",
      actionLabel: "Browse",
      actionIcon: "search",
    };
  }

  if (pathname === "/methodology") {
    return {
      kind: "deep",
      title: "Methodology",
      subtitle: "How Classify earns trust.",
      backHref: "/search",
    };
  }

  if (pathname === "/login") {
    return {
      kind: "deep",
      title: "Sign in",
      subtitle: "Google or email link.",
      backHref: "/search",
    };
  }

  if (pathname === "/profile") {
    return {
      kind: "deep",
      title: "Profile",
      subtitle: "Your account.",
      backHref: "/search",
    };
  }

  if (pathname.startsWith("/schools/")) {
    const schoolRoot = schoolRootFromPath(pathname);
    if (pathname.includes("/my-courses")) {
      return {
      kind: "deep",
      title: "Planner",
      subtitle: "Shortlist and build your term.",
        backHref: schoolRoot,
      };
    }
    if (pathname.includes("/courses/")) {
      return {
        kind: "deep",
        title: "Course",
        subtitle: "Compare instructors and outcomes fast.",
        backHref: schoolRoot,
      };
    }
    if (pathname.includes("/professors/")) {
      return {
        kind: "deep",
        title: "Professor",
        subtitle: "Evidence, trends, and fit at a glance.",
        backHref: schoolRoot,
      };
    }
    if (pathname.includes("/departments/")) {
      return {
        kind: "deep",
        title: "Department",
        subtitle: "Ranked by outcomes and difficulty.",
        backHref: schoolRoot,
      };
    }
    if (pathname.includes("/instructors")) {
      return {
        kind: "deep",
        title: "Instructors",
        subtitle: "Browse the full school directory.",
        backHref: schoolRoot,
      };
    }
    return {
      kind: "deep",
      title: "School",
      subtitle: "Courses, instructors, and planning.",
      backHref: "/search",
    };
  }

  return {
    kind: "deep",
    title: "Classify",
    subtitle: "Course intelligence for your next move.",
    backHref: "/search",
  };
}

export function MobileRouteBar({ tone = "app" }: { tone?: "home" | "app" }) {
  const pathname = usePathname();
  const meta = getRouteMeta(pathname);
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
              <Link
                href={meta.backHref ?? "/search"}
                className={cn(
                  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
                  tone === "home"
                    ? "border-white/15 bg-white/8 text-ivory"
                    : "border-border bg-white/74 text-ink",
                )}
                aria-label="Go back"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
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
