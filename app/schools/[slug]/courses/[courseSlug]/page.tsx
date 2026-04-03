import { notFound } from "next/navigation";
import { CourseProfessorList } from "@/components/course/course-professor-list";
import { GradeDistributionPanel } from "@/components/charts/grade-distribution-panel";
import { MetricTrendChart } from "@/components/charts/metric-trend-chart";
import { CoverageBadge } from "@/components/coverage-badge";
import { SiteHeader } from "@/components/site-header";
import {
  getCatalogSchools,
  getCourseGroup,
  getCourseOfferings,
  getCourseGroupsForSchool,
  getCourseTrend,
  getGradeDistributionSeriesForCourse,
} from "@/lib/catalog";

type CoursePageProps = {
  params: Promise<{ slug: string; courseSlug: string }>;
};

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return getCatalogSchools().flatMap((school) =>
    getCourseGroupsForSchool(school.slug).map((course) => ({
      slug: school.slug,
      courseSlug: course.courseSlug,
    })),
  );
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug, courseSlug } = await params;
  const course = getCourseGroup(slug, courseSlug);
  const offerings = getCourseOfferings(slug, courseSlug);

  if (!course || !offerings.length) notFound();

  const courseTrend = getCourseTrend(slug, courseSlug);
  const gradeSeries = getGradeDistributionSeriesForCourse(slug, courseSlug);

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{course.department}</p>
              <h1 className="app-page-title mt-3 font-semibold text-ink">
                {course.courseCode} - {course.courseName}
              </h1>
              <p className="app-lead mt-4">
                {course.summary}{" "}
                This is the exact question RMP cannot answer well:
                who teaches this required course and gives the most A&apos;s?
              </p>
            </div>
            <CoverageBadge tier={course.coverageTier} />
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <MetricTrendChart trend={courseTrend} metric="aPct" />
            <MetricTrendChart trend={courseTrend} metric="avgGpa" />
          </div>
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted">
              Stacked grade bars are modeled from each term&apos;s reported GPA and A-rate when
              full A–F counts are not in the catalog—they are a visual companion to the headline
              stats, not a separate official breakdown.
            </p>
            <GradeDistributionPanel series={gradeSeries} />
          </div>
        </section>

        <CourseProfessorList offerings={offerings} schoolSlug={slug} />
      </div>
    </main>
  );
}
