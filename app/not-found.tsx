import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-16">
        <div className="soft-panel rounded-[34px] px-6 py-16 text-center sm:px-10">
          <p className="eyebrow">Not found</p>
          <h1 className="display-title mt-4 text-4xl font-semibold text-ink">
            This record is not published in the current Classify dataset yet
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted">
            The route exists for nationwide coverage, but this record has not been
            published from the live directory or aggregate pipeline yet.
          </p>
          <Link
            href="/search"
            className="mt-8 inline-flex rounded-full bg-deep-ink px-5 py-3 text-sm font-medium text-ivory"
          >
            Go back to search
          </Link>
        </div>
      </div>
    </main>
  );
}
