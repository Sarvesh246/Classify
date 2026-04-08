"use client";

import Link from "next/link";
import { useState } from "react";
import { GraduationCap, RotateCcw, School, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { clearRecentSearches, readRecentSearches, type RecentSearchEntry } from "@/lib/recent-searches";
import { cn } from "@/lib/utils";

const iconMap = {
  school: School,
  course: GraduationCap,
  professor: UserRound,
} as const;

export function RecentSearchesPanel({
  title = "Recent",
  subtitle = "Jump back into what you were checking last.",
  compact = false,
  tone = "light",
  className,
}: {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  tone?: "light" | "dark";
  className?: string;
}) {
  const [items, setItems] = useState<RecentSearchEntry[]>(() => readRecentSearches());

  if (!items.length) {
    return (
      <div
        className={cn(
          "rounded-[24px] px-4 py-5 text-sm",
          tone === "dark"
            ? "border border-dashed border-white/12 bg-[linear-gradient(180deg,rgba(8,25,44,0.64),rgba(8,25,44,0.48))] text-white/74"
            : "border border-dashed border-border/80 bg-white/56 text-muted",
          className,
        )}
      >
        <p className={cn("font-medium", tone === "dark" ? "text-white" : "text-ink")}>{title}</p>
        <p className="mt-1 leading-6">{subtitle}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[28px] p-4",
        tone === "dark"
          ? "border border-white/12 bg-[linear-gradient(180deg,rgba(8,25,44,0.68),rgba(8,25,44,0.5))] shadow-[0_20px_44px_rgba(4,12,24,0.24)]"
          : "border border-border/75 bg-white/70 shadow-[0_14px_36px_rgba(7,17,31,0.06)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn("eyebrow", tone === "dark" && "text-white/72")}>{title}</p>
          {!compact ? (
            <p className={cn("mt-2 text-sm", tone === "dark" ? "text-white/72" : "text-muted")}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            clearRecentSearches();
            setItems([]);
          }}
          className={cn(
            "inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-medium",
            tone === "dark"
              ? "border border-white/12 bg-white/10 text-white/72"
              : "border border-border/80 bg-background text-muted",
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {items.slice(0, compact ? 3 : 5).map((item, index) => {
          const Icon = iconMap[item.type];
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.22 }}
            >
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-[22px] px-3 py-3 transition",
                  tone === "dark"
                    ? "border border-white/12 bg-white/10 hover:bg-white/14"
                    : "border border-border/65 bg-background/80 hover:bg-white",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-deep-ink text-ivory">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm font-semibold",
                      tone === "dark" ? "text-white" : "text-ink",
                    )}
                  >
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-xs",
                      tone === "dark" ? "text-white/64" : "text-muted",
                    )}
                  >
                    {item.school}
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.18em]",
                    tone === "dark"
                      ? "border border-white/12 bg-white/12 text-white/70"
                      : "border border-border-strong bg-surface-well text-muted",
                  )}
                >
                  {item.type}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
