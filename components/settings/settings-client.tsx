"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, BookOpen, MapPin, RotateCcw, Search, Smartphone, Trash2 } from "lucide-react";
import { ThemePreferenceControl } from "@/components/settings/theme-preference-control";
import { useCombinedAuth } from "@/components/auth/use-combined-auth";
import {
  clearPlannerLocalCourseEntries,
  resetIosInstallBannerDismissed,
} from "@/lib/classify-client-storage";
import { clearRecentSearches } from "@/lib/recent-searches";
import { applyThemeClass, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

export function SettingsClient() {
  const { user, hydrated } = useCombinedAuth();
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setThemePreference(root.classList.contains("dark") ? "dark" : "light");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (event.newValue === "light" || event.newValue === "dark") {
        setThemePreference(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function onThemePreference(next: ThemePreference) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyThemeClass(next);
    setThemePreference(next);
  }

  function flash(message: string) {
    setClearMsg(message);
    window.setTimeout(() => setClearMsg(null), 3200);
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {clearMsg ? (
        <p
          className="rounded-[20px] border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-ink"
          role="status"
        >
          {clearMsg}
        </p>
      ) : null}

      <ThemePreferenceControl
        themePreference={themePreference}
        onThemePreference={onThemePreference}
      />

      <section className="rounded-[28px] classify-inner p-6 sm:p-7" aria-labelledby="search-history-heading">
        <div className="flex items-start gap-3">
          <Search className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="search-history-heading" className="text-lg font-semibold text-ink">
              Search history
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Recent searches you open from this browser are stored locally. Clearing them does not remove
              saved professors or courses in your account.
            </p>
            <button
              type="button"
              onClick={() => {
                clearRecentSearches();
                flash("Recent searches cleared on this device.");
              }}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface-strong px-5 text-sm font-semibold text-ink transition hover:border-copper/35 hover:bg-copper/5 dark:hover:bg-white/5"
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              Clear recent searches
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] classify-inner p-6 sm:p-7" aria-labelledby="planner-local-heading">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="planner-local-heading" className="text-lg font-semibold text-ink">
              Planner (this device)
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              My Courses stores a local copy of your picked sections URL state per school so the planner
              reloads quickly. Removing it does not delete cloud shortlists or drafts when you are signed
              in.
            </p>
            <button
              type="button"
              onClick={() => {
                const n = clearPlannerLocalCourseEntries();
                flash(
                  n > 0
                    ? `Cleared ${n} local planner ${n === 1 ? "entry" : "entries"}.`
                    : "No local planner entries to clear.",
                );
              }}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface-strong px-5 text-sm font-semibold text-ink transition hover:border-copper/35 hover:bg-copper/5 dark:hover:bg-white/5"
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
              Clear local planner cache
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] classify-inner p-6 sm:p-7" aria-labelledby="mobile-tip-heading">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="mobile-tip-heading" className="text-lg font-semibold text-ink">
              Mobile install tip
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              If you dismissed the “Add to Home Screen” banner on iPhone Safari, you can surface it again on
              your next visit to the home page (when eligible).
            </p>
            <button
              type="button"
              onClick={() => {
                resetIosInstallBannerDismissed();
                flash("Install tip reset. Open home on iPhone Safari to see it when available.");
              }}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface-strong px-5 text-sm font-semibold text-ink transition hover:border-copper/35 hover:bg-copper/5 dark:hover:bg-white/5"
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
              Show install tip again
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] classify-inner p-6 sm:p-7" aria-labelledby="trust-heading">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="trust-heading" className="text-lg font-semibold text-ink">
              Data & trust
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Read how grades, schedules, and reviews are combined—and what “official” means in Classify.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/methodology"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-deep-ink px-5 text-sm font-semibold !text-ivory shadow-sm transition hover:opacity-92"
              >
                Methodology
              </Link>
            </div>
          </div>
        </div>
      </section>

      {hydrated && user ? (
        <section className="rounded-[28px] classify-inner p-6 sm:p-7" aria-labelledby="account-settings-heading">
          <div className="flex items-start gap-3">
            <Bookmark className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 id="account-settings-heading" className="text-lg font-semibold text-ink">
                Account & saves
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Email, sign-in method, and cloud saves are on your profile. Nothing here deletes account
                data.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/profile"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong bg-surface-strong px-5 text-sm font-semibold text-ink transition hover:border-teal/35 hover:bg-surface-raised-top dark:hover:bg-white/5"
                >
                  Open profile
                </Link>
                <Link
                  href="/saved"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong bg-surface-strong px-5 text-sm font-semibold text-ink transition hover:border-teal/35 hover:bg-surface-raised-top dark:hover:bg-white/5"
                >
                  Saved
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {hydrated && !user ? (
        <section className="rounded-[28px] border border-dashed border-border/80 bg-surface-well/30 p-6 sm:p-7 dark:bg-surface-well/20">
          <h2 className="text-lg font-semibold text-ink">Sign in for cloud saves</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Saved professors and planner sync use an account. Theme and local options above work without
            signing in.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-deep-ink px-5 text-sm font-semibold !text-ivory transition hover:opacity-92"
          >
            Log in or create account
          </Link>
        </section>
      ) : null}
    </div>
  );
}
