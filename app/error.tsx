"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
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
    <main className="min-h-screen bg-background px-4 py-14">
      <div className="page-shell">
        <div className="soft-panel rounded-[34px] px-6 py-16 text-center sm:px-10">
          <p className="eyebrow">Something broke</p>
          <h1 className="display-title mt-4 text-4xl font-semibold text-ink">
            Classify hit an unexpected error
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted">
            The page failed to render. Try reloading the route, or jump back into
            search while the failure is investigated.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-full bg-deep-ink px-5 py-3 text-sm font-medium text-ivory"
            >
              Retry page
            </button>
            <Link
              href="/search"
              className="rounded-full border border-border px-5 py-3 text-sm font-medium text-ink"
            >
              Open search
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
