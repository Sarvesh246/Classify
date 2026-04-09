import { RouteLoadingShell } from "@/components/loading/route-loading-shell";
import { SearchResultsSkeleton } from "@/components/search/search-results-skeleton";

export default function Loading() {
  return (
    <RouteLoadingShell
      eyebrow="Search"
      title="Loading search results."
      body="Matching schools, courses, and instructors to your query."
      loadingLabel="Searching Classify"
      loadingDetail="Ranking and coverage signals are updating now."
      footer={<SearchResultsSkeleton />}
    />
  );
}
