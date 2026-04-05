import { ClassifyLoadingMark } from "@/components/loading/classify-loading-mark";
import { SiteHeader } from "@/components/site-header";

/** Full-page route transition shell (Next.js `loading.tsx` segments). */
export function RouteLoadingShell() {
  return (
    <main className="min-h-screen bg-background md:bg-background">
      <SiteHeader tone="app" />
      <div className="page-shell px-4 pb-20 pt-4 md:flex md:min-h-[min(70vh,540px)] md:flex-col md:items-center md:justify-center md:pt-12">
        <div className="mx-auto max-w-xl md:hidden">
          <div className="rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,25,44,0.74),rgba(8,25,44,0.58))] p-5 text-white shadow-[0_24px_50px_rgba(4,12,24,0.28)] backdrop-blur-xl">
            <p className="eyebrow text-white/72">Opening Classify</p>
            <h1 className="display-title mt-2 text-[2rem] font-semibold leading-[0.96] tracking-[-0.08em] text-white">
              Your course decision workspace is loading.
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/72">
              Pulling school coverage, instructor picks, and planner-ready options.
            </p>
            <div className="mt-5 flex items-center gap-4 rounded-[24px] border border-white/12 bg-white/10 px-4 py-4">
              <ClassifyLoadingMark size="md" tone="onDark" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Building your launchpad</p>
                <p className="mt-1 text-xs text-white/68">Search, compare, and saved work are getting ready.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden md:flex md:min-h-[min(70vh,540px)] md:flex-col md:items-center md:justify-center">
          <ClassifyLoadingMark size="lg" tone="light" />
          <p className="mt-8 text-[0.72rem] uppercase tracking-[0.2em] text-muted">
            Loading
          </p>
        </div>
      </div>
    </main>
  );
}
