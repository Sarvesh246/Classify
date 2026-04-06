import {
  getCatalogCoverageStats,
  getFeaturedOfferings,
  getSchoolsForHomeNationalGraphSpotlights,
} from "@/lib/catalog";
import { getDirectorySchools, getSchoolHub } from "@/lib/server-directory";
import { HomeExperience } from "@/components/home/home-experience";
import { SiteHeader } from "@/components/site-header";

export default async function HomePage() {
  const [coverage, directorySchools, spotlightSchools, featured] = await Promise.all([
    getCatalogCoverageStats(),
    getDirectorySchools(),
    getSchoolsForHomeNationalGraphSpotlights(),
    getFeaturedOfferings(),
  ]);
  const searchableSchools = Math.max(
    directorySchools.length,
    coverage.searchableSchools ?? coverage.trackedSchools,
  );
  const spotlightSlugs = spotlightSchools.map((school) => school.slug);
  const spotlightEntries = await Promise.all(spotlightSlugs.map((slug) => getSchoolHub(slug)));
  const spotlights = spotlightEntries
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      school: item.school,
      courses: item.courses.slice(0, 2),
      trending: item.trending.slice(0, 1),
    }));

  return (
    <main className="min-h-dvh bg-deep-ink text-ivory">
      <SiteHeader tone="home" />
      <HomeExperience
        coverage={{
          ...coverage,
          searchableSchools,
          trackedSchools: searchableSchools,
        }}
        featured={featured}
        spotlights={spotlights}
      />
    </main>
  );
}
