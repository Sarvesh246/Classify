"use client";

import { useEffect } from "react";
import { initFirebaseAnalytics } from "@/lib/firebase/client";

/**
 * Registers Firebase Analytics once per session in the browser.
 * Safe when Firebase env vars are unset (no-op).
 */
export function FirebaseAnalytics() {
  useEffect(() => {
    let cancelled = false;
    const browser = globalThis as typeof globalThis & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleCallbackId: number | null = null;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

    if (typeof browser.requestIdleCallback === "function") {
      idleCallbackId = browser.requestIdleCallback(
        () => {
          if (!cancelled) {
            void initFirebaseAnalytics();
          }
        },
        { timeout: 2_000 },
      );
    } else {
      timeoutId = globalThis.setTimeout(() => {
        if (!cancelled) {
          void initFirebaseAnalytics();
        }
      }, 900);
    }

    return () => {
      cancelled = true;
      if (timeoutId != null) {
        globalThis.clearTimeout(timeoutId);
      }
      if (idleCallbackId != null && typeof browser.cancelIdleCallback === "function") {
        browser.cancelIdleCallback(idleCallbackId);
      }
    };
  }, []);

  return null;
}
