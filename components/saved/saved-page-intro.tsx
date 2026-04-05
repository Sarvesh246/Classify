"use client";

import Link from "next/link";
import { useCombinedAuth } from "@/components/auth/use-combined-auth";

export function SavedPageIntro() {
  const { user, supabaseUserId, hydrated } = useCombinedAuth();

  if (!hydrated) {
    return (
      <p className="app-lead mt-4">
        Your saved professors, courses, compare sets, and planner drafts live here.
      </p>
    );
  }

  if (supabaseUserId) {
    return (
      <p className="app-lead mt-4">
        This is your personal library. Anything you save from search, compare, or planning
        shows up here across devices.
      </p>
    );
  }

  if (user) {
    return (
      <p className="app-lead mt-4">
        You&apos;re signed in, but cloud saves still use Classify email sign-in for now.{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-2">
          Sign in with email
        </Link>{" "}
        to sync this library everywhere.
      </p>
    );
  }

  return (
    <p className="app-lead mt-4">
      Save professors, courses, and compare work here.{" "}
      <Link href="/login" className="font-medium text-ink underline underline-offset-2">
        Sign in
      </Link>{" "}
      or{" "}
      <Link href="/search" className="font-medium text-ink underline underline-offset-2">
        keep browsing
      </Link>
      .
    </p>
  );
}
