"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getRouteShellMeta } from "@/lib/route-shell-meta";
import { cn } from "@/lib/utils";

export function HeaderBackButton({
  tone = "app",
  className,
}: {
  tone?: "home" | "app";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const meta = getRouteShellMeta(pathname);
  const fallback = meta.backHref ?? "/search";

  if (meta.kind !== "deep") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors",
        "hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/35",
        "motion-reduce:transition-none",
        tone === "home"
          ? "border-white/15 bg-white/8 text-ivory hover:bg-white/14"
          : "border-border bg-white/74 text-ink hover:border-teal/35",
        className,
      )}
      aria-label="Go back to previous page"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden />
    </button>
  );
}
