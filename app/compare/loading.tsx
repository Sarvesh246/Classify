import { RouteLoadingShell } from "@/components/loading/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Opening compare"
      title="Loading your compare workspace."
      body="Preparing the builder, saved sets, and comparison cards."
      loadingLabel="Warming up compare"
      loadingDetail="Your selected instructors and filters are on the way."
    />
  );
}
