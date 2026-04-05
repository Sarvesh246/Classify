import { CompareBuilderClient } from "./compare-builder-client";
import { SiteHeader } from "@/components/site-header";
import { getCatalogOfferings } from "@/lib/catalog";

type ComparePageProps = {
  searchParams: Promise<{ ids?: string; school?: string }>;
};

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const ids = params.ids?.split(",").filter(Boolean) ?? [];
  const school = params.school?.trim() || undefined;
  const catalog = await getCatalogOfferings();

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
