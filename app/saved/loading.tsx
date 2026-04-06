import { RouteLoadingShell } from "@/components/loading/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Opening saved"
      title="Loading your academic library."
      body="Restoring saved professors, courses, and compare sets."
      loadingLabel="Syncing your library"
      loadingDetail="Saved work is being prepared without losing your place."
    />
  );
}
