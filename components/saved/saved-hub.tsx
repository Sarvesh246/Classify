"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Cloud, FolderHeart, Layers3 } from "lucide-react";
import { useCombinedAuth } from "@/components/auth/use-combined-auth";
import { ClassifyLoadingMark } from "@/components/loading/classify-loading-mark";
import {
  deleteCompareSet,
  deleteSavedItem,
  fetchCompareSets,
  fetchSavedItems,
  type CompareSetRow,
  type SavedItemRow,
} from "@/lib/me-api-client";

export function SavedHub() {
  const { user, supabaseUserId, hydrated } = useCombinedAuth();
  const [items, setItems] = useState<SavedItemRow[] | null>(null);
  const [sets, setSets] = useState<CompareSetRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
  const [pendingSetIds, setPendingSetIds] = useState<string[]>([]);

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
    const previous = items;
    setPendingItemIds((current) => [...current, id]);
    setItems((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
    try {
      await deleteSavedItem(id);
    } catch {
      setItems(previous);
      setError("Could not remove that item. Try again.");
    } finally {
      setPendingItemIds((current) => current.filter((value) => value !== id));
    }
  }

  async function removeSet(id: string) {
    const previous = sets;
    setPendingSetIds((current) => [...current, id]);
    setSets((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
    try {
      await deleteCompareSet(id);
    } catch {
      setSets(previous);
      setError("Could not remove that compare set. Try again.");
    } finally {
      setPendingSetIds((current) => current.filter((value) => value !== id));
    }
  }

  function formatSavedSchool(slug: string | null | undefined) {
    if (!slug) return "School";
    return slug
      .split("-")
      .map((part) =>
        part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1),
      )
      .join(" ");
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center gap-4 rounded-[28px] border border-border/70 bg-white/60 py-10">
        <ClassifyLoadingMark size="sm" tone="light" />
      </div>
    );
  }

  if (!supabaseUserId) {
    return user ? (
      <div className="space-y-4">
        <LibraryPreview />
        <div className="rounded-[28px] border border-border/70 bg-white/62 px-5 py-5 text-sm text-muted shadow-[0_18px_34px_rgba(7,17,31,0.06)]">
          <div className="flex items-start gap-3">
            <Cloud className="mt-0.5 h-5 w-5 text-deep-ink" />
            <div>
              <p className="font-semibold text-ink">Library sync is almost on</p>
              <p className="mt-1 leading-6">
                You&apos;re signed in, but cross-device saves still use Classify email
                sign-in for now.
              </p>
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        <LibraryPreview />
        <div className="rounded-[28px] border border-border/70 bg-white/62 px-5 py-5 text-sm text-muted shadow-[0_18px_34px_rgba(7,17,31,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">Turn on cloud saves</p>
              <p className="mt-1 leading-6">
                Sign in with <strong className="text-ink">email</strong> to sync professors,
                courses, compare sets, and planner drafts across devices.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-deep-ink px-4 text-sm font-medium !text-ivory"
            >
              Sign in
            </Link>
          </div>
        </div>
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
      <div className="space-y-4">
        <div className="soft-panel rounded-[28px] px-6 py-8 text-left text-muted">
          <p className="text-lg font-semibold text-ink">Your library is ready.</p>
          <p className="mt-2 text-sm leading-6">
            Save a professor, course, compare set, or planner draft and it will show up here.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link
              href="/search"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-deep-ink px-5 text-sm font-medium !text-ivory"
            >
              Browse search
            </Link>
            <Link
              href="/compare"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/80 px-5 text-sm font-medium text-ink"
            >
              Open compare
            </Link>
          </div>
        </div>
        <LibraryPreview compact />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Compare sets" value={sets.length} />
        <SummaryCard label="Saved items" value={items.length} />
        <SummaryCard label="Sync" value="On" muted="Email-linked" />
      </section>

      {sets.length > 0 ? (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Compare sets</h2>
            <Link href="/compare" className="inline-flex items-center gap-1 text-sm font-medium text-ink">
              Open compare
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
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
                    {s.school_slug ? ` · ${formatSavedSchool(s.school_slug)}` : ""}
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
                    disabled={pendingSetIds.includes(s.id)}
                    onClick={() => void removeSet(s.id)}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted hover:text-ink disabled:opacity-55"
                  >
                    {pendingSetIds.includes(s.id) ? "Removing..." : "Remove"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {items.length > 0 ? (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Saved picks</h2>
            <Link href="/search" className="inline-flex items-center gap-1 text-sm font-medium text-ink">
              Browse more
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
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
                  <p className="text-sm text-muted">{formatSavedSchool(item.school_slug)}</p>
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
                    disabled={pendingItemIds.includes(item.id)}
                    onClick={() => void removeItem(item.id)}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted hover:text-ink disabled:opacity-55"
                  >
                    {pendingItemIds.includes(item.id) ? "Removing..." : "Remove"}
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

function SummaryCard({
  label,
  value,
  muted,
}: {
  label: string;
  value: number | string;
  muted?: string;
}) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-white/70 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
      {muted ? <p className="mt-1 text-sm text-muted">{muted}</p> : null}
    </div>
  );
}

function LibraryPreview({ compact = false }: { compact?: boolean }) {
  const sections = [
    {
      icon: <FolderHeart className="h-4 w-4" />,
      title: "Saved professors",
      body: "Keep strong instructor options close.",
    },
    {
      icon: <BookOpen className="h-4 w-4" />,
      title: "Saved courses",
      body: "Return to important classes without starting over.",
    },
    {
      icon: <Layers3 className="h-4 w-4" />,
      title: "Compare sets & drafts",
      body: "Store side-by-side picks and planning work.",
    },
  ];

  return (
    <section className="rounded-[28px] border border-border/70 bg-white/56 p-4">
      <p className="eyebrow">Library preview</p>
      {!compact ? (
        <p className="mt-2 text-sm leading-6 text-muted">
          Classify remembers the work you want to come back to during course selection.
        </p>
      ) : null}
      <div className="mt-4 grid gap-2">
        {sections.map((section) => (
          <div
            key={section.title}
            className="flex items-start gap-3 rounded-[22px] border border-border/70 bg-background/82 px-4 py-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-deep-ink text-ivory">
              {section.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{section.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{section.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
