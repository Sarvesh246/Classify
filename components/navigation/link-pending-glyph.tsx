"use client";

import { useLinkStatus } from "next/link";
import { ClassifyLoadingMark } from "@/components/loading/classify-loading-mark";
import { cn } from "@/lib/utils";

/**
 * Must render as a descendant of `next/link`’s `<Link>` — shows the Classify histogram mark while
 * the linked route is loading (client navigation).
 */
export function LinkPendingGlyph({
  tone = "light",
  className,
}: {
  tone?: "light" | "onDark";
  className?: string;
}) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className={cn("inline-flex shrink-0", className)} aria-hidden="true">
      <ClassifyLoadingMark size="sm" tone={tone} label="Loading page" />
    </span>
  );
}
