"use client";

import Link from "next/link";
import { LinkPendingGlyph } from "@/components/navigation/link-pending-glyph";
import { cn } from "@/lib/utils";

/** Search result card link with in-flight loading mark (histogram). */
export function SearchHitLink({
  href,
  className,
  children,
  glyphTone = "light",
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  /** Use `onDark` on glass / deep-ink cards (e.g. home featured picks). */
  glyphTone?: "light" | "onDark";
}) {
  return (
    <Link href={href} className={cn("relative", className)}>
      <LinkPendingGlyph
        tone={glyphTone}
        className="pointer-events-none absolute right-3 top-3 z-[1]"
      />
      {children}
    </Link>
  );
}
