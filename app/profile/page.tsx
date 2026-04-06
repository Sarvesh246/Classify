import Link from "next/link";
import { ProfileClient } from "@/components/auth/profile-client";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Profile",
  description: "Your Classify account and sign-in preferences.",
};

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-8 pb-20 sm:pt-12 sm:pb-24">
        <div className="mx-auto w-full max-w-lg">
          <p className="eyebrow text-muted">Account</p>
          <h1 className="app-page-title mt-2 font-semibold text-ink">Your profile</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Signed-in features include saved lists and planner sync when you use email sign-in.
          </p>
          <div className="mt-8">
            <ProfileClient />
          </div>
          <p className="mt-10 text-center text-sm text-muted">
            <Link href="/search" className="font-medium text-ink underline-offset-2 hover:underline">
              Back to search
            </Link>
            <span className="mx-2 text-border">·</span>
            <Link href="/saved" className="font-medium text-ink underline-offset-2 hover:underline">
              Saved
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
