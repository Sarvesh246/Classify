"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { signOutAll } from "@/utils/supabase/sign-out";
import { cn } from "@/lib/utils";

export function UserAccountMenu({
  firstName,
  isHome,
  compact = false,
}: {
  firstName: string;
  isHome: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerClass = cn(
    "inline-flex max-w-full items-center gap-1 rounded-full text-sm font-medium transition-all duration-200 ease-out",
    compact ? "min-h-11 px-3 py-2" : "px-3 py-2",
    "hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm",
    "motion-reduce:transform-none motion-reduce:hover:shadow-none",
    isHome
      ? "bg-ivory/12 text-ivory ring-1 ring-white/20 hover:bg-white/14 hover:ring-white/30"
      : "border border-border bg-surface-strong/92 text-ink hover:border-teal/35 hover:bg-surface-raised-top hover:ring-1 hover:ring-teal/15 dark:hover:bg-white/10",
  );

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center">
      <button
        type="button"
        id={`${menuId}-trigger`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={`${menuId}-menu`}
        onClick={() => setOpen((o) => !o)}
        className={triggerClass}
      >
        <span className="max-w-[10rem] truncate">{firstName}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 opacity-80 transition", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={`${menuId}-menu`}
          aria-labelledby={`${menuId}-trigger`}
          className={cn(
            "absolute right-0 top-[calc(100%+0.35rem)] z-[80] min-w-[12rem] rounded-[20px] border py-1 shadow-lg",
            isHome
              ? "border-white/14 bg-deep-ink/95 text-ivory backdrop-blur-xl"
              : "border-border/80 bg-surface-strong/98 text-ink backdrop-blur-xl dark:border-border-strong dark:bg-surface-raised-bottom/98",
          )}
        >
          <Link
            href="/profile"
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium transition",
              isHome ? "hover:bg-white/10" : "hover:bg-deep-ink/[0.06]",
            )}
            onClick={() => setOpen(false)}
          >
            <UserRound className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            Profile
          </Link>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition",
              isHome ? "hover:bg-white/10" : "hover:bg-deep-ink/[0.06]",
            )}
            onClick={() => {
              setOpen(false);
              void signOutAll();
            }}
          >
            <LogOut className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
