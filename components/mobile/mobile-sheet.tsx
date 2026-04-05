"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
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
      <motion.button
        type="button"
        className="absolute inset-0 bg-deep-ink/45"
        onClick={onClose}
        aria-label={`Close ${title}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="mobile-sheet-shell absolute inset-x-0 bottom-0 max-h-[84dvh] overflow-hidden rounded-t-[30px] bg-background"
        initial={{ y: 40, opacity: 0.9 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 26, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="soft-panel mobile-app-scroll h-full overflow-y-auto rounded-t-[30px] border-b-0 p-4 pb-6">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-border/90" />
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
      </motion.div>
    </div>
  );
}
