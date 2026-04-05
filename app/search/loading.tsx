import { ClassifyLoadingMark } from "@/components/loading/classify-loading-mark";
import { SiteHeader } from "@/components/site-header";

export default function SearchLoading() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10 pb-16">
        <section className="soft-panel flex flex-col items-center gap-10 rounded-[34px] px-6 py-14 sm:px-10">
          <ClassifyLoadingMark size="md" tone="light" />
          <div className="h-14 w-full max-w-2xl rounded-[22px] bg-deep-ink/[0.07]" />
          <p className="text-[0.72rem] uppercase tracking-[0.2em] text-muted">
            Preparing search
          </p>
        </section>
        <div
          className="mt-8 min-h-[18rem] rounded-[30px] border border-border/50 bg-white/35"
          aria-hidden
        />
      </div>
    </main>
  );
}
