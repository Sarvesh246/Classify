import { RouteLoadingShell } from "@/components/loading/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Opening planner"
      title="Loading your shortlist planner."
      body="Preparing saved picks, course rows, and section-ready recommendations."
      loadingLabel="Bootstrapping planner"
      loadingDetail="Your shortlist and planner actions are getting ready."
    />
  );
}
