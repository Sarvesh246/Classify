"use client";

import { useEffect, useState } from "react";
import { SavedHubShell } from "@/components/saved/saved-hub-shell";
import { SavedPageIntro } from "@/components/saved/saved-page-intro";

export function SavedPageClientSurface() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <>
        <p className="app-lead mt-4">
          Your saved professors, courses, compare sets, and planner drafts live here.
        </p>
        <div className="mt-6 flex min-h-[12rem] flex-col items-center justify-center gap-4 rounded-[28px] classify-inner-soft py-10 sm:mt-8" />
      </>
    );
  }

  return (
    <>
      <SavedPageIntro />
      <div className="mt-6 sm:mt-8">
        <SavedHubShell />
      </div>
    </>
  );
}
