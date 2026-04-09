import { RouteLoadingShell } from "@/components/loading/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Profile"
      title="Loading your profile."
      body="Account preferences and saved workspace."
      loadingLabel="Preparing profile"
      loadingDetail="Your settings are loading now."
    />
  );
}
