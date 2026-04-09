"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { LinkPendingGlyph } from "@/components/navigation/link-pending-glyph";
import { cn } from "@/lib/utils";

type PendingLinkProps = Omit<ComponentProps<typeof Link>, "children"> & {
  children: React.ReactNode;
  /** Show histogram mark before or after label (default end). */
  pendingPlacement?: "start" | "end";
};

/**
 * Same as `next/link` with inline loading feedback while the navigation is in flight.
 */
export function PendingLink({
  children,
  className,
  pendingPlacement = "end",
  ...props
}: PendingLinkProps) {
  return (
    <Link
      {...props}
      className={cn("inline-flex items-center justify-center gap-2", className)}
    >
      {pendingPlacement === "start" ? <LinkPendingGlyph /> : null}
      <span className="min-w-0">{children}</span>
      {pendingPlacement === "end" ? <LinkPendingGlyph /> : null}
    </Link>
  );
}
