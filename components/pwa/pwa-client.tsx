"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function PwaClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    // Repair older installs that still launch into `/search?source=pwa`.
    if (pathname === "/search" && searchParams.get("source") === "pwa") {
      router.replace("/");
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // Check for updates on each fresh launch so installed web app doesn't stay stale.
        void registration.update();
      })
      .catch(() => {
        // Keep failures silent in the UI; the app remains fully usable online-first.
      });
  }, []);

  return null;
}
