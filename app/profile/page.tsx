import Link from "next/link";
import { ProfileClient } from "@/components/auth/profile-client";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Profile",
  description: "Your Classify account, workspace shortcuts, and preferences.",
};

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-8 pb-16 sm:pt-12 md:pb-10">
        <div className="shell-inner-wide">
          <header className="border-b border-border/50 pb-6 sm:pb-8">
            <p className="eyebrow text-muted">Account</p>
            <h1 className="app-page-title mt-2 font-semibold text-ink">Profile</h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
              Manage how you show up in Classify and jump to your workspace. Theme, history, and device
              options live in <Link href="/settings">Settings</Link>. Email sign-in powers saved lists and
              planner sync across devices.
            </p>
          </header>

          <div className="mt-8 sm:mt-10">
            <ProfileClient />
          </div>

          <nav
            className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/40 pt-8 text-sm text-muted sm:mt-12"
            aria-label="Footer links"
          >
            <Link href="/settings" className="font-medium text-ink underline-offset-2 hover:underline">
              Settings
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
            <Link href="/saved" className="font-medium text-ink underline-offset-2 hover:underline">
              Saved
            </Link>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <Link href="/compare" className="font-medium text-ink underline-offset-2 hover:underline">
              Compare
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
