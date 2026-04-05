"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

export function MobileSheet({
  title,
  subtitle = "Mobile workspace",
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overlay-layer fixed inset-0 z-[240] md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-deep-ink/45"
        onClick={onClose}
        aria-label={`Close ${title}`}
      />
      <div className="mobile-sheet-shell absolute inset-x-0 bottom-0 max-h-[84dvh] overflow-hidden rounded-t-[30px] bg-background">
        <div className="soft-panel mobile-app-scroll h-full overflow-y-auto rounded-t-[30px] border-b-0 p-4 pb-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{subtitle}</p>
              <h3 className="mt-2 text-2xl font-semibold text-ink">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white/80 text-ink"
              aria-label={`Dismiss ${title}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
