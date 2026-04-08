"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback } from "react";
import { applyThemeClass, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

type Tone = "home" | "app";

export function ThemeToggle({
  tone = "app",
  compact = false,
}: {
  tone?: Tone;
  compact?: boolean;
}) {
  const toggle = useCallback(() => {
    const currentlyDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");
    const next: ThemePreference = currentlyDark ? "light" : "dark";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyThemeClass(next);
  }, []);

  const isHome = tone === "home";

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border transition-colors",
        compact ? "h-11 w-11" : "h-11 min-w-[2.75rem] px-3",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40",
        "motion-reduce:transition-none",
        isHome
          ? "border-white/20 bg-white/10 text-ivory hover:bg-white/16"
          : "border-border-strong bg-surface-strong/95 text-ink hover:border-teal/35 hover:bg-surface-raised-top/90 dark:hover:bg-white/8",
      )}
      aria-label="Toggle color theme"
    >
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden />
      <Moon className="block h-4 w-4 dark:hidden" aria-hidden />
    </button>
  );
}
