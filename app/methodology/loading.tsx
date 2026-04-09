import { RouteLoadingShell } from "@/components/loading/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Methodology"
      title="Loading methodology."
      body="How Classify scores, sources, and explains coverage."
      loadingLabel="Loading content"
      loadingDetail="Transparency details are almost ready."
    />
  );
}
