"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Share2, X } from "lucide-react";
import { useAppRuntime } from "@/hooks/use-app-runtime";

const STORAGE_KEY = "classify:ios-install-banner-dismissed";
const SURFACE_ROUTES = new Set(["/"]);

export function MobileInstallBanner() {
  const { isStandalone, isIosSafari } = useAppRuntime();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.localStorage.getItem(STORAGE_KEY) === "1",
  );

  if (
    !isIosSafari ||
    isStandalone ||
    dismissed ||
    !pathname ||
    !SURFACE_ROUTES.has(pathname)
  ) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-3 bottom-[var(--mobile-install-offset)] z-[95] mx-auto max-w-[25rem] md:hidden"
    >
      <div className="soft-panel rounded-[22px] px-3.5 py-2.5 text-ink shadow-[0_20px_40px_rgba(7,17,31,0.12)]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-deep-ink text-ivory">
            <Share2 className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.92rem] font-semibold text-ink">Add Classify to Home Screen</p>
            <p className="mt-0.5 text-[0.72rem] leading-5 text-muted">
              Tap Share, then <span className="font-medium text-ink">Add to Home Screen</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem(STORAGE_KEY, "1");
              setDismissed(true);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-raised-top text-muted transition-colors hover:border-teal/40 hover:text-ink"
            aria-label="Dismiss install hint"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
