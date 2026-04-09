"use client";

import { Palette } from "lucide-react";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemePreferenceControl({
  themePreference,
  onThemePreference,
  className,
}: {
  themePreference: ThemePreference;
  onThemePreference: (next: ThemePreference) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col rounded-[28px] classify-inner p-6 sm:p-7", className)}>
      <div className="flex items-start gap-3">
        <Palette className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">Appearance</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Default theme on this device. You can still toggle from the header anytime.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
        <button
          type="button"
          onClick={() => onThemePreference("dark")}
          aria-pressed={themePreference === "dark"}
          className={`inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
            themePreference === "dark"
              ? "border-deep-ink bg-deep-ink text-ivory shadow-sm"
              : "classify-chip-surface text-ink hover:bg-surface-raised-top/90"
          }`}
        >
          Dark
        </button>
        <button
          type="button"
          onClick={() => onThemePreference("light")}
          aria-pressed={themePreference === "light"}
          className={`inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
            themePreference === "light"
              ? "border-deep-ink bg-deep-ink text-ivory shadow-sm"
              : "classify-chip-surface text-ink hover:bg-surface-raised-top/90"
          }`}
        >
          Light
        </button>
      </div>
    </div>
  );
}
