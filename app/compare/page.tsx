import { CompareBuilder } from "@/components/compare/compare-builder";
import { SiteHeader } from "@/components/site-header";
import { getCatalogOfferings } from "@/lib/catalog";

type ComparePageProps = {
  searchParams: Promise<{ ids?: string; school?: string }>;
};

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const ids = params.ids?.split(",").filter(Boolean) ?? [];
  const school = params.school?.trim() || undefined;
  const catalog = getCatalogOfferings();

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10">
        <CompareBuilder
          catalog={catalog}
          initialSelectedIds={ids}
          initialSchoolSlug={school}
        />
      </div>
    </main>
  );
}
