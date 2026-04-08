"use client";

import { useEffect } from "react";
import {
  applyThemeClass,
  readStoredTheme,
  resolveStoredOrSystemTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const sync = () => {
      const stored = readStoredTheme();
      const pref: ThemePreference =
        stored ?? (resolveStoredOrSystemTheme() === "dark" ? "dark" : "light");
      applyThemeClass(pref);
    };
    sync();

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => {
      if (readStoredTheme() === null) {
        applyThemeClass(resolveStoredOrSystemTheme() === "dark" ? "dark" : "light");
      }
    };
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === "dark" || e.newValue === "light")) {
        applyThemeClass(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return <>{children}</>;
}
