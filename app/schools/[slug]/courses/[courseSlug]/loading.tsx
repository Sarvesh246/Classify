import { RouteLoadingShell } from "@/components/loading/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Opening course"
      title="Loading this course view."
      body="Pulling instructor offerings, grade context, and compare-ready stats."
      loadingLabel="Preparing course data"
      loadingDetail="Sections and instructor picks are loading now."
    />
  );
}
