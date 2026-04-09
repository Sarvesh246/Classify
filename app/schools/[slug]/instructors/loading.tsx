import { RouteLoadingShell } from "@/components/loading/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Instructors"
      title="Loading the instructor directory."
      body="Pulling searchable faculty rows, filters, and pagination."
      loadingLabel="Preparing directory"
      loadingDetail="Instructor coverage and stats are loading now."
    />
  );
}
