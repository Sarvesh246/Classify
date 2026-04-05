import { ClassifyLoadingMark } from "@/components/loading/classify-loading-mark";
import { SiteHeader } from "@/components/site-header";

/** Full-page route transition shell (Next.js `loading.tsx` segments). */
export function RouteLoadingShell() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell flex min-h-[min(70vh,540px)] flex-col items-center justify-center px-4 pb-20 pt-12">
        <ClassifyLoadingMark size="lg" tone="light" />
        <p className="mt-8 text-[0.72rem] uppercase tracking-[0.2em] text-muted">
          Loading
        </p>
      </div>
    </main>
  );
}
