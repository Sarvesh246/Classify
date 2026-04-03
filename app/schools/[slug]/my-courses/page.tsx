import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MyCoursesPlanner } from "@/components/my-courses/my-courses-planner";
import { SiteHeader } from "@/components/site-header";
import {
  getCatalogOfferingsForSchool,
  getCatalogSchoolBySlug,
  getCatalogSchools,
  getCourseGroupsForSchool,
} from "@/lib/catalog";
import type { ProfessorCourseSummary } from "@/lib/types";

type MyCoursesPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ courses?: string }>;
};

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return getCatalogSchools().map((school) => ({ slug: school.slug }));
}

function groupOfferingsByCourse(slug: string): Record<string, ProfessorCourseSummary[]> {
  const map: Record<string, ProfessorCourseSummary[]> = {};
  for (const o of getCatalogOfferingsForSchool(slug)) {
    if (!map[o.courseSlug]) map[o.courseSlug] = [];
    map[o.courseSlug].push(o);
  }
  return map;
}

function parseCoursesParam(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function MyCoursesPage({ params, searchParams }: MyCoursesPageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const school = getCatalogSchoolBySlug(slug);
  if (!school) notFound();

  const courseGroups = getCourseGroupsForSchool(slug);
  const offeringsByCourseSlug = groupOfferingsByCourse(slug);
  const initialCoursesFromUrl = parseCoursesParam(sp.courses);

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <p className="eyebrow">{school.shortName}</p>
          <h1 className="app-page-title mt-3 font-semibold text-ink">My courses</h1>
          <p className="app-lead mt-4">
            Build a shortlist of catalog courses and compare every published instructor row in one
            place. Sort matches individual course pages; picks stay in this browser unless you open
            a share link.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/schools/${slug}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink"
            >
              School hub
            </Link>
            <Link
              href={`/schools/${slug}/instructors`}
              className="rounded-full bg-deep-ink px-4 py-2 text-sm font-medium text-ivory"
            >
              Browse all instructors
            </Link>
          </div>
        </section>

        <div className="mt-8">
          <Suspense
            fallback={
              <div className="soft-panel rounded-[30px] p-8 text-sm text-muted">
                Loading planner…
              </div>
            }
          >
            <MyCoursesPlanner
              schoolSlug={slug}
              courseGroups={courseGroups}
              offeringsByCourseSlug={offeringsByCourseSlug}
              initialCoursesFromUrl={initialCoursesFromUrl}
            />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
