import { CompareBuilderClient } from "./compare-builder-client";
import { SiteHeader } from "@/components/site-header";
import { getCatalogOfferingsByIds, getCatalogOfferingsForSchool } from "@/lib/catalog";

type ComparePageProps = {
  searchParams: Promise<{ ids?: string; school?: string }>;
};

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const ids = params.ids?.split(",").filter(Boolean) ?? [];
  const school = params.school?.trim() || undefined;
  const [selectedRows, schoolCatalog] = await Promise.all([
    getCatalogOfferingsByIds(ids),
    school ? getCatalogOfferingsForSchool(school) : Promise.resolve([]),
  ]);
  const catalog = [
    ...new Map([...selectedRows, ...schoolCatalog].map((item) => [item.id, item])).values(),
  ];

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-4 md:pt-10">
        <CompareBuilderClient
          catalog={catalog}
          initialSelectedIds={ids}
          initialSchoolSlug={school}
        />
      </div>
    </main>
  );
}
