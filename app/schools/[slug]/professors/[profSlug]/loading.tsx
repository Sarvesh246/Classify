import { RouteLoadingShell } from "@/components/loading/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Opening profile"
      title="Loading this professor profile."
      body="Pulling instructor identity, outcomes, and trend evidence."
      loadingLabel="Preparing professor data"
      loadingDetail="Profile stats and supporting signals are loading now."
    />
  );
}
