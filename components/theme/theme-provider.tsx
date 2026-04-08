"use client";

import { useEffect } from "react";
import {
  applyThemeClass,
  readStoredTheme,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = readStoredTheme();
    applyThemeClass(stored ?? "dark");
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
