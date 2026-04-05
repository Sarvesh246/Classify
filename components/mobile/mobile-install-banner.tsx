"use client";

import { useState } from "react";
import { Share2, X } from "lucide-react";
import { useAppRuntime } from "@/hooks/use-app-runtime";

const STORAGE_KEY = "classify:ios-install-banner-dismissed";

export function MobileInstallBanner() {
  const { isStandalone, isIosSafari } = useAppRuntime();
  const [dismissed, setDismissed] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.localStorage.getItem(STORAGE_KEY) === "1",
  );

  if (!isIosSafari || isStandalone || dismissed) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-[var(--mobile-install-offset)] z-[95] md:hidden">
      <div className="soft-panel rounded-[26px] p-4 text-ink">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Install Classify</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              On iPhone, tap <Share2 className="mx-1 inline h-4 w-4 align-[-2px]" /> then{" "}
              <span className="font-medium text-ink">Add to Home Screen</span> for the
              app-style version.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem(STORAGE_KEY, "1");
              setDismissed(true);
            }}
            className="rounded-full border border-border bg-white/78 p-2 text-muted"
            aria-label="Dismiss install hint"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
