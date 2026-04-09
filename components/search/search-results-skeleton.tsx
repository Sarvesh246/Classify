/** Placeholder rows while search results stream in (Next.js `loading.tsx` + shared patterns). */
export function SearchResultsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mt-8 w-full space-y-4" aria-hidden="true">
      <div className="h-4 w-40 animate-pulse rounded-full bg-border/60 dark:bg-border/40" />
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="soft-panel flex gap-4 rounded-[var(--radius-card)] p-4 sm:p-5"
        >
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-border/50 dark:bg-border/30" />
          <div className="min-w-0 flex-1 space-y-3 py-0.5">
            <div className="h-4 w-[min(100%,14rem)] animate-pulse rounded-full bg-border/60 dark:bg-border/40" />
            <div className="h-3 w-[min(100%,22rem)] animate-pulse rounded-full bg-border/40 dark:bg-border/25" />
            <div className="flex flex-wrap gap-2">
              <div className="h-6 w-16 animate-pulse rounded-full bg-border/45 dark:bg-border/30" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-border/45 dark:bg-border/30" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
