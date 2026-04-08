"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ClassifyLogo } from "@/components/classify-logo";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 pb-10">
      <div className="page-shell">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-ink" aria-label="Classify home">
            <ClassifyLogo compact />
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm font-medium text-muted">
            <Link href="/search" className="text-ink underline-offset-2 hover:text-teal hover:underline">
              Search
            </Link>
            <Link href="/saved" className="text-ink underline-offset-2 hover:text-teal hover:underline">
              Saved
            </Link>
            <Link href="/compare" className="text-ink underline-offset-2 hover:text-teal hover:underline">
              Compare
            </Link>
          </nav>
        </div>

        <div className="soft-panel mt-8 rounded-[34px] px-6 py-16 text-center sm:px-10">
          <p className="eyebrow">Something went wrong</p>
          <h1 className="display-title mt-4 text-4xl font-semibold text-ink">
            This page didn&apos;t load
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted">
            Try again in a moment. If it keeps happening, use search or another tab above—your
            work in other tabs is safe.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-deep-ink px-5 py-3 text-sm font-medium text-ivory"
            >
              Try again
            </button>
            <Link
              href="/search"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-medium text-ink"
            >
              Open search
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
