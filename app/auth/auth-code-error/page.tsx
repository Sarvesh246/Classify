import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function AuthCodeErrorPage() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10 pb-16">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <p className="eyebrow">Sign in</p>
          <h1 className="app-page-title mt-3 font-semibold text-ink">Sign-in link didn&apos;t work</h1>
          <p className="app-lead mt-4">
            The link may have expired or already been used. Request a new email sign-in link from the{" "}
            <Link href="/login" className="font-medium text-ink underline underline-offset-2">
              log in
            </Link>{" "}
            page, or continue browsing without an account.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-deep-ink px-5 text-sm font-medium text-ivory"
            >
              Back to log in
            </Link>
            <Link
              href="/search"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong px-5 text-sm font-medium text-ink"
            >
              Open search
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
