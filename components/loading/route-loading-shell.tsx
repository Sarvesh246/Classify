import type { ReactNode } from "react";
import { ClassifyLoadingMark } from "@/components/loading/classify-loading-mark";
import { SiteHeader } from "@/components/site-header";

/** Full-page route transition shell (Next.js `loading.tsx` segments). */
export function RouteLoadingShell({
  eyebrow = "Opening Classify",
  title = "Your course decision workspace is loading.",
  body = "Pulling school coverage, instructor picks, and planner-ready options.",
  loadingLabel = "Building your launchpad",
  loadingDetail = "Search, compare, and saved work are getting ready.",
  footer,
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
  loadingLabel?: string;
  loadingDetail?: string;
  footer?: ReactNode;
} = {}) {
  return (
    <main className="min-h-screen min-w-0 overflow-x-clip bg-background md:bg-background">
      <SiteHeader tone="app" />
      <div className="page-shell pb-20 pt-4 md:flex md:min-h-[min(70vh,540px)] md:flex-col md:items-center md:justify-center md:pt-12">
        <div className="shell-inner-narrow md:hidden">
          <div className="rounded-[var(--radius-card)] border border-white/12 bg-[linear-gradient(180deg,rgba(8,25,44,0.74),rgba(8,25,44,0.58))] p-5 text-white shadow-[0_24px_50px_rgba(4,12,24,0.28)] backdrop-blur-xl">
            <p className="eyebrow text-white/72">{eyebrow}</p>
            <h1 className="display-title mt-2 text-[2rem] font-semibold leading-[0.96] tracking-[-0.08em] text-white">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/72">
              {body}
            </p>
            <div className="mt-5 flex items-center gap-4 rounded-[24px] border border-white/12 bg-white/10 px-4 py-4">
              <ClassifyLoadingMark size="md" tone="onDark" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{loadingLabel}</p>
                <p className="mt-1 text-xs text-white/68">{loadingDetail}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden shell-inner-narrow md:flex md:min-h-[min(70vh,540px)] md:flex-col md:items-center md:justify-center">
          <div className="w-full rounded-[var(--radius-card)] border border-border-strong bg-surface-strong/90 p-6 text-ink shadow-classify-panel">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="display-title mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
            <div className="mt-6 flex items-center gap-4 rounded-[24px] border border-border/80 bg-background/60 px-4 py-4">
              <ClassifyLoadingMark size="md" tone="light" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{loadingLabel}</p>
                <p className="mt-1 text-xs text-muted">{loadingDetail}</p>
              </div>
            </div>
          </div>
        </div>
        {footer ? (
          <div className="shell-inner-wide w-full pb-8 pt-2 md:mt-4 md:max-w-none md:self-stretch">
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}
