"use client";

import { useEffect } from "react";
import { initFirebaseAnalytics } from "@/lib/firebase/client";

/**
 * Registers Firebase Analytics once per session in the browser.
 * Safe when Firebase env vars are unset (no-op).
 */
export function FirebaseAnalytics() {
  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);

  return null;
}
