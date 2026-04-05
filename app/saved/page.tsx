import Link from "next/link";
import { SavedHubShell } from "@/components/saved/saved-hub-shell";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Saved",
  description: "Professors and courses you saved on Classify.",
};

export default function SavedPage() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10 pb-16">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <p className="eyebrow">Your library</p>
          <h1 className="app-page-title mt-3 font-semibold text-ink">Saved</h1>
          <p className="app-lead mt-4">
            Bookmarks sync when you sign in with email.{" "}
            <Link href="/login" className="font-medium text-ink underline underline-offset-2">
              Sign in
            </Link>{" "}
            or{" "}
            <Link href="/search" className="font-medium text-ink underline underline-offset-2">
              keep browsing
            </Link>
            .
          </p>
        </section>
        <div className="mt-8">
          <SavedHubShell />
        </div>
      </div>
    </main>
  );
}
