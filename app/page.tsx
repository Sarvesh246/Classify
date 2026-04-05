import {
  getCatalogCoverageStats,
  getCatalogSchools,
  getFeaturedOfferings,
} from "@/lib/catalog";
import { getDirectorySchools, getSchoolHub } from "@/lib/server-directory";
import { HomeExperience } from "@/components/home/home-experience";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [coverage, directorySchools, catalogSchools, featured] = await Promise.all([
    getCatalogCoverageStats(),
    getDirectorySchools(),
    getCatalogSchools(),
    getFeaturedOfferings(),
  ]);
  const trackedSchools = Math.max(directorySchools.length, coverage.trackedSchools);
  const spotlightSlugs = catalogSchools
    .slice(0, 6)
    .map((school) => school.slug);
  const spotlightEntries = await Promise.all(spotlightSlugs.map((slug) => getSchoolHub(slug)));
  const spotlights = spotlightEntries
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      school: item.school,
      courses: item.courses.slice(0, 2),
      trending: item.trending.slice(0, 1),
    }));

  return (
    <main className="min-h-screen">
      <SiteHeader tone="home" />
      <HomeExperience
        coverage={{
          ...coverage,
          trackedSchools,
        }}
        featured={featured}
        spotlights={spotlights}
      />
    </main>
  );
}
