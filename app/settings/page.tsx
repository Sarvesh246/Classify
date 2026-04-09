import Link from "next/link";
import { SettingsClient } from "@/components/settings/settings-client";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Settings",
  description: "Appearance, device data, and privacy-related options for Classify.",
};

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-8 pb-16 sm:pt-12 md:pb-10">
        <div className="shell-inner-narrow">
          <header className="border-b border-border/50 pb-6 sm:pb-8">
            <p className="eyebrow text-muted">Preferences</p>
            <h1 className="app-page-title mt-2 font-semibold text-ink">Settings</h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
              Tune how Classify looks and behaves on this browser. Account details and sign-out stay on
              your profile.
            </p>
          </header>

          <div className="mt-8 sm:mt-10">
            <SettingsClient />
          </div>

          <nav
            className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/40 pt-8 text-sm text-muted sm:mt-12"
            aria-label="Footer links"
          >
            <Link href="/profile" className="font-medium text-ink underline-offset-2 hover:underline">
              Profile
            </Link>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <Link href="/search" className="font-medium text-ink underline-offset-2 hover:underline">
              Search
            </Link>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <Link href="/" className="font-medium text-ink underline-offset-2 hover:underline">
              Home
            </Link>
          </nav>
        </div>
      </div>
    </main>
  );
}
