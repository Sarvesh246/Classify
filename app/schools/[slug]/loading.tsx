import { RouteLoadingShell } from "@/components/loading/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Opening school"
      title="Loading this school hub."
      body="Pulling course coverage, instructor depth, and planner readiness."
      loadingLabel="Preparing the school workspace"
      loadingDetail="Coverage details and instructor signals are loading now."
    />
  );
}
