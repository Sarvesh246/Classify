"use client";

import { useEffect } from "react";

export function PwaClient() {
  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Keep failures silent in the UI; the app remains fully usable online-first.
    });
  }, []);

  return null;
}
