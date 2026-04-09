import { RouteLoadingShell } from "@/components/loading/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Sign in"
      title="Loading sign-in."
      body="Choose Google or email link to continue."
      loadingLabel="Opening sign-in"
      loadingDetail="Authentication options are loading now."
    />
  );
}
