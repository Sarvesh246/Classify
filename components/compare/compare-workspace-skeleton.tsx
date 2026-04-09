export function CompareWorkspaceSkeleton() {
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2" aria-hidden="true">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="soft-panel space-y-4 rounded-[var(--radius-panel)] p-5 sm:p-6"
        >
          <div className="h-5 w-[60%] max-w-[12rem] animate-pulse rounded-full bg-border/55 dark:bg-border/35" />
          <div className="h-4 w-full max-w-md animate-pulse rounded-full bg-border/40 dark:bg-border/25" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-24 animate-pulse rounded-2xl bg-border/35 dark:bg-border/20" />
            <div className="h-24 animate-pulse rounded-2xl bg-border/35 dark:bg-border/20" />
          </div>
        </div>
      ))}
    </div>
  );
}
