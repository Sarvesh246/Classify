import { ClassifyLoadingMark } from "@/components/loading/classify-loading-mark";
import { cn } from "@/lib/utils";

/** Soft-panel block for Suspense / async sections (not for sub-200ms UI). */
export function LoadingFallbackPanel({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "soft-panel flex flex-col items-center justify-center gap-6 rounded-[30px] px-8 py-14",
        className,
      )}
    >
      <ClassifyLoadingMark size="md" tone="light" />
      {message ? (
        <p className="text-[0.72rem] uppercase tracking-[0.2em] text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Minimal centering wrapper for small Suspense islands. */
export function LoadingFallbackCompact({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-14", className)}>
      <ClassifyLoadingMark size="sm" tone="light" />
    </div>
  );
}
