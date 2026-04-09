"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { signOutAll } from "@/utils/supabase/sign-out";
import { cn } from "@/lib/utils";

const MENU_COUNT = 3;

export function UserAccountMenu({
  firstName,
  isHome,
  compact = false,
}: {
  firstName: string;
  isHome: boolean;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([null, null, null]);
  const menuId = useId();

  const focusItem = useCallback((i: number) => {
    const el = itemRefs.current[Math.max(0, Math.min(MENU_COUNT - 1, i))];
    el?.focus();
  }, []);

  const currentFocusIndex = useCallback(() => {
    const ae = document.activeElement;
    return itemRefs.current.findIndex((el) => el === ae);
  }, []);

  const closeAndReturnFocus = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen((o) => {
        if (o) requestAnimationFrame(() => triggerRef.current?.focus());
        return false;
      });
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => focusItem(0));
  }, [open, focusItem]);

  const menuItemClass = cn(
    "flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors duration-150",
    "first:rounded-t-[var(--radius-menu)] last:rounded-b-[var(--radius-menu)]",
    "focus-visible:outline-none",
    isHome
      ? "hover:bg-white/[0.15] focus-visible:bg-white/[0.15]"
      : cn(
          "hover:bg-deep-ink/[0.07] focus-visible:bg-deep-ink/[0.07]",
          "dark:hover:bg-white/[0.14] dark:focus-visible:bg-white/[0.14]",
        ),
  );

  const triggerClass = cn(
    "inline-flex max-w-full items-center gap-1 rounded-full text-sm font-medium transition-all duration-200 ease-out",
    compact ? "min-h-11 px-3 py-2" : "px-3 py-2",
    "hover:-translate-y-px active:translate-y-0",
    "motion-reduce:transform-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-deep-ink",
    isHome
      ? "bg-ivory/12 text-ivory ring-1 ring-white/20 hover:bg-white/14 hover:ring-white/30"
      : "border border-border bg-surface-strong/92 text-ink shadow-classify-pill hover:border-teal/35 hover:bg-surface-raised-top hover:shadow-classify-pill-hover hover:ring-1 hover:ring-teal/15 active:shadow-classify-pill dark:hover:bg-white/10 motion-reduce:hover:shadow-classify-pill",
  );

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAndReturnFocus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const i = currentFocusIndex();
      const next = i < 0 ? 0 : (i + 1) % MENU_COUNT;
      focusItem(next);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const i = currentFocusIndex();
      const prev = i <= 0 ? MENU_COUNT - 1 : i - 1;
      focusItem(prev);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      focusItem(MENU_COUNT - 1);
    }
  }

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0 flex-col items-stretch">
      <button
        ref={triggerRef}
        type="button"
        id={`${menuId}-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${menuId}-menu`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusItem(0));
          }
        }}
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
          role="menu"
          aria-labelledby={`${menuId}-trigger`}
          aria-orientation="vertical"
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute right-0 top-[calc(100%+0.35rem)] z-[80] overflow-hidden rounded-[var(--radius-menu)] border shadow-lg",
            "left-auto w-[min(max(100%,12rem),calc(100vw-1rem))]",
            isHome
              ? "border-white/14 text-ivory"
              : "border-border/80 text-ink dark:border-border-strong",
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-[var(--radius-menu)]",
              isHome
                ? "bg-deep-ink/95 backdrop-blur-xl"
                : "bg-surface-strong/98 backdrop-blur-xl dark:bg-surface-raised-bottom/98",
            )}
            aria-hidden
          />
          <div
            className={cn(
              "relative z-[1] flex w-full min-w-0 flex-col",
              isHome ? "text-ivory" : "text-ink",
            )}
          >
            <Link
              ref={(el) => {
                itemRefs.current[0] = el;
              }}
              href="/profile"
              role="menuitem"
              tabIndex={-1}
              aria-current={pathname === "/profile" ? "page" : undefined}
              className={menuItemClass}
              onClick={() => setOpen(false)}
            >
              <UserRound className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              Profile
            </Link>
            <Link
              ref={(el) => {
                itemRefs.current[1] = el;
              }}
              href="/settings"
              role="menuitem"
              tabIndex={-1}
              aria-current={pathname === "/settings" ? "page" : undefined}
              className={menuItemClass}
              onClick={() => setOpen(false)}
            >
              <Settings className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              Settings
            </Link>
            <button
              ref={(el) => {
                itemRefs.current[2] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={menuItemClass}
              onClick={() => {
                setOpen(false);
                void signOutAll();
              }}
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
