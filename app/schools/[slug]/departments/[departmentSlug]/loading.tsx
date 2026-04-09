import { RouteLoadingShell } from "@/components/loading/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Department"
      title="Loading this department."
      body="Pulling instructor rankings, GPA signals, and trend views."
      loadingLabel="Preparing department view"
      loadingDetail="Sortable instructor data is loading now."
    />
  );
}
