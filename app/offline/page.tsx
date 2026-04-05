import Link from "next/link";

export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <main className="page-shell flex min-h-[100dvh] items-center py-12">
      <section className="soft-panel mx-auto max-w-xl rounded-[32px] p-8 text-center sm:p-10">
        <p className="eyebrow">Offline</p>
        <h1 className="display-title mt-4 text-4xl font-semibold text-ink">
          Classify needs a connection for live results
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted">
          The installed app can reopen its shell and some recently visited pages, but fresh
          search, planner solves, and school data still depend on the network.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/search"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-deep-ink px-5 text-sm font-semibold text-ivory"
          >
            Retry search
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white/78 px-5 text-sm font-medium text-ink"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
