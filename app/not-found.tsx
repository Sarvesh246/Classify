import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-16">
        <div className="soft-panel rounded-[34px] px-6 py-16 text-center sm:px-10">
          <p className="eyebrow">Page not found</p>
          <h1 className="display-title mt-4 text-4xl font-semibold text-ink">
            We couldn&apos;t find that page
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted">
            The link may be mistyped, or a school or professor page isn&apos;t available yet. Try
            search, or browse from home.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/search"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-deep-ink px-5 py-3 text-sm font-medium text-ivory"
            >
              Open search
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong px-5 py-3 text-sm font-medium text-ink"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
