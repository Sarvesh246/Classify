"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useCombinedAuth } from "@/components/auth/use-combined-auth";
import { fetchSavedItems, postSavedItem } from "@/lib/me-api-client";
import { cn } from "@/lib/utils";

type SaveItemButtonProps = {
  itemType: "professor" | "course";
  schoolSlug: string;
  professorSlug?: string;
  courseSlug?: string;
  className?: string;
  /** Compact icon-only on small headers */
  variant?: "default" | "compact";
};

export function SaveItemButton({
  itemType,
  schoolSlug,
  professorSlug,
  courseSlug,
  className,
  variant = "default",
}: SaveItemButtonProps) {
  const { supabaseUserId, hydrated } = useCombinedAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSaved = useCallback(async () => {
    if (!supabaseUserId) return;
    const data = await fetchSavedItems();
    if (!data) return;
    const hit = data.items.some((i) => {
      if (i.item_type !== itemType || i.school_slug !== schoolSlug) return false;
      if (itemType === "professor") return i.professor_slug === professorSlug;
      return i.course_slug === courseSlug;
    });
    setSaved(hit);
  }, [supabaseUserId, itemType, schoolSlug, professorSlug, courseSlug]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  if (!hydrated) {
    return null;
  }

  if (!supabaseUserId) {
    return (
      <Link
        href="/login"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-4 py-2 text-sm font-medium text-ink transition hover:bg-white",
          className,
        )}
      >
        <Bookmark className="h-4 w-4" aria-hidden />
        {variant === "compact" ? null : <span>Save</span>}
        <span className="sr-only">Sign in to save</span>
      </Link>
    );
  }

  async function onSave() {
    if (saved || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await postSavedItem({
        itemType,
        schoolSlug,
        professorSlug: itemType === "professor" ? professorSlug : undefined,
        courseSlug: itemType === "course" ? courseSlug : undefined,
      });
      if (res?.ok || res?.alreadySaved) {
        setSaved(true);
      } else if (res == null) {
        setError("Session expired. Sign in again to save.");
      } else {
        setError("Couldn't save. Try again.");
      }
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("inline-flex flex-col items-end gap-1", className)}>
      <button
        type="button"
        onClick={() => void onSave()}
        disabled={saved || busy}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
          saved
            ? "cursor-default border-teal/40 bg-teal/10 text-ink"
            : "border-border bg-white/80 text-ink hover:bg-white",
        )}
      >
        <Bookmark className={cn("h-4 w-4", saved && "fill-current")} aria-hidden />
        {busy ? "Saving…" : saved ? "Saved" : variant === "compact" ? null : "Save"}
      </button>
      {error ? (
        <p className="max-w-[14rem] text-right text-xs font-medium text-copper" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
