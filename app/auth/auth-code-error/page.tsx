import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function AuthCodeErrorPage() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10 pb-16">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <h1 className="app-page-title font-semibold text-ink">Sign-in link didn&apos;t work</h1>
          <p className="app-lead mt-4">
            The link may have expired or already been used. Request a new email sign-in link from the{" "}
            <Link href="/login" className="font-medium text-ink underline underline-offset-2">
              log in
            </Link>{" "}
            page.
          </p>
        </section>
      </div>
    </main>
  );
}
