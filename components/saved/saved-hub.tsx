"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClassifyLoadingMark } from "@/components/loading/classify-loading-mark";
import { useCombinedAuth } from "@/components/auth/use-combined-auth";
import {
  deleteCompareSet,
  deleteSavedItem,
  fetchCompareSets,
  fetchSavedItems,
  type CompareSetRow,
  type SavedItemRow,
} from "@/lib/me-api-client";

export function SavedHub() {
  const { supabaseUserId, hydrated } = useCombinedAuth();
  const [items, setItems] = useState<SavedItemRow[] | null>(null);
  const [sets, setSets] = useState<CompareSetRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !supabaseUserId) return;

    let ignore = false;

    Promise.all([fetchSavedItems(), fetchCompareSets()])
      .then(([i, c]) => {
        if (ignore) return;
        if (!i || !c) {
          setError("Could not load saved data. Try signing in again.");
          setItems([]);
          setSets([]);
        } else {
          setError(null);
          setItems(i.items);
          setSets(c.sets);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("Something went wrong.");
          setItems([]);
          setSets([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, [hydrated, supabaseUserId]);

  async function removeItem(id: string) {
    await deleteSavedItem(id);
    setItems((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
  }

  async function removeSet(id: string) {
    await deleteCompareSet(id);
    setSets((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center gap-4 rounded-[28px] border border-border/70 bg-white/60 py-10">
        <ClassifyLoadingMark size="sm" tone="light" />
      </div>
    );
  }

  if (!supabaseUserId) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-white/50 px-6 py-12 text-center text-sm text-muted">
        Sign in with <strong className="text-ink">email</strong> to sync saved professors, courses,
        and compare sets across devices. Google sign-in alone doesn&apos;t enable cloud saves yet.
      </div>
    );
  }

  if (items === null || sets === null) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center gap-4 rounded-[28px] border border-border/70 bg-white/60 py-10">
        <ClassifyLoadingMark size="sm" tone="light" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm font-medium text-copper">{error}</p>;
  }

  const hasAny = (items?.length ?? 0) > 0 || (sets?.length ?? 0) > 0;

  if (!hasAny) {
    return (
      <div className="soft-panel rounded-[28px] px-6 py-14 text-center text-muted">
        <p className="text-ink">Nothing saved yet.</p>
        <p className="mt-2 text-sm">
          Open a professor or course page and tap <strong className="text-ink">Save</strong>, or save a
          comparison from the compare page.
        </p>
        <Link
          href="/search"
          className="mt-6 inline-flex rounded-full bg-deep-ink px-5 py-2.5 text-sm font-medium !text-ivory"
        >
          Browse search
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {sets && sets.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-ink">Compare sets</h2>
          <ul className="mt-4 space-y-3">
            {sets.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-3 rounded-[24px] border border-border/70 bg-white/72 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {s.offering_ids.length} instructor{s.offering_ids.length === 1 ? "" : "s"}
                    {s.school_slug ? ` · ${s.school_slug}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/compare?ids=${encodeURIComponent(s.offering_ids.join(","))}${s.school_slug ? `&school=${encodeURIComponent(s.school_slug)}` : ""}`}
                    className="rounded-full bg-deep-ink px-4 py-2 text-sm font-medium !text-ivory"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => void removeSet(s.id)}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {items && items.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-ink">Professors & courses</h2>
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-[24px] border border-border/70 bg-white/72 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">
                    {item.item_type}
                  </p>
                  <p className="mt-1 font-medium text-ink">
                    {item.item_type === "professor"
                      ? item.professor_slug?.replace(/-/g, " ")
                      : `${item.course_slug?.replace(/-/g, " ")}`}
                  </p>
                  <p className="text-sm text-muted">{item.school_slug}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={
                      item.item_type === "professor"
                        ? `/schools/${item.school_slug}/professors/${item.professor_slug}`
                        : `/schools/${item.school_slug}/courses/${item.course_slug}`
                    }
                    className="rounded-full bg-deep-ink px-4 py-2 text-sm font-medium !text-ivory"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => void removeItem(item.id)}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
