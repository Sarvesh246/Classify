"use client";

import dynamic from "next/dynamic";

const FirebaseAnalytics = dynamic(
  () =>
    import("@/components/firebase-analytics").then((m) => m.FirebaseAnalytics),
  { ssr: false },
);

export function FirebaseAnalyticsLoader() {
  return <FirebaseAnalytics />;
}
