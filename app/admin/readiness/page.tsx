import { SiteHeader } from "@/components/site-header";
import {
  getCatalogDataOriginTrace,
  getCatalogPublishMetadata,
  getCatalogReadinessSummary,
  getCatalogSchools,
  getCatalogUpdatedAt,
} from "@/lib/catalog";
import { getPublishedCatalogDbHealth } from "@/lib/published-catalog-db-source";
import { formatFreshnessLabel, formatPlannerReadiness } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminReadinessPage() {
  const [dbHealth, trace, publishMetadata, readiness, schools, updatedAt] = await Promise.all([
    getPublishedCatalogDbHealth(),
    Promise.resolve(getCatalogDataOriginTrace()),
    getCatalogPublishMetadata(),
    getCatalogReadinessSummary(),
    getCatalogSchools(),
    getCatalogUpdatedAt(),
  ]);

  const weakestSchools = [...schools]
    .sort((left, right) => {
      const leftPct = left.supportProfile?.evidenceCompletenessPct ?? 0;
      const rightPct = right.supportProfile?.evidenceCompletenessPct ?? 0;
      return leftPct - rightPct;
    })
    .slice(0, 12);

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell py-10 space-y-8">
        <section className="soft-panel rounded-[30px] p-6">
          <p className="eyebrow">Operational readiness</p>
          <h1 className="app-page-title mt-3 text-ink">Production readiness dashboard</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted">
            This surface reports whether Classify is truly serving the published DB layer,
            how many schools have planner-grade depth, and which schools still need catalog,
            section, or evidence expansion.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Effective source" value={trace.publishedDataFrom} meta={`Updated ${formatFreshnessLabel(updatedAt)}`} />
            <StatCard label="DB path" value={dbHealth.requiredTablesOk ? "Healthy" : "Fallback"} meta={dbHealth.requiredTablesOk ? "Required tables reachable" : `${dbHealth.missingRequiredTables.length} required tables missing`} />
            <StatCard label="Evidence-ready schools" value={String(readiness.evidenceReady)} meta={`${readiness.totalSchools} total schools`} />
            <StatCard label="Active publish run" value={publishMetadata?.runId ?? "Unavailable"} meta={publishMetadata ? `Activated ${formatFreshnessLabel(publishMetadata.activatedAt)}` : "No publish metadata loaded"} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="soft-panel rounded-[28px] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Readiness mix</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">School support levels</h2>
              </div>
              <span className="rounded-full border border-border bg-white/70 px-3 py-1.5 text-xs text-muted">
                Breadth-first launch gates
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <StatCard label="Directory ready" value={String(readiness.directoryReady)} />
              <StatCard label="Catalog ready" value={String(readiness.catalogReady)} />
              <StatCard label="Schedule ready" value={String(readiness.scheduleReady)} />
              <StatCard label="Evidence ready" value={String(readiness.evidenceReady)} />
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-ink">DB table status</p>
              <div className="mt-3 space-y-2">
                {dbHealth.tables.map((table) => (
                  <div
                    key={table.table}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border/70 bg-white/70 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{table.table}</p>
                      <p className="text-xs text-muted">
                        {table.required ? "Required for DB path" : "Optional published table"}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${table.ok ? "bg-[#E7F4DB] text-[#376100]" : "bg-[#FFE7E6] text-[#8C2B2A]"}`}>
                      {table.ok ? "OK" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="soft-panel rounded-[28px] p-6">
            <p className="eyebrow">Expansion queue</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Schools needing depth</h2>
            <p className="mt-2 text-sm text-muted">
              Lowest evidence completeness first. These schools are live, but they still need catalog,
              section timing, or ranking evidence before they should be marketed as planner-grade.
            </p>
            <div className="mt-5 space-y-3">
              {weakestSchools.map((school) => (
                <div
                  key={school.slug}
                  className="rounded-[20px] border border-border/70 bg-white/70 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{school.shortName}</p>
                      <p className="text-xs text-muted">{school.city}, {school.state}</p>
                    </div>
                    <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted">
                      {formatPlannerReadiness(school.supportProfile?.plannerReadiness ?? "directory_ready")}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
                    <span>Catalog {school.supportProfile?.catalogCompletenessPct ?? 0}%</span>
                    <span>Sections {school.supportProfile?.sectionCompletenessPct ?? 0}%</span>
                    <span>Meeting times {school.supportProfile?.meetingTimeCompletenessPct ?? 0}%</span>
                    <span>Evidence {school.supportProfile?.evidenceCompletenessPct ?? 0}%</span>
                  </div>
                  {school.supportProfile?.readinessReason ? (
                    <p className="mt-3 text-xs text-muted">{school.supportProfile.readinessReason}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="rounded-[22px] border border-border/70 bg-white/70 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {meta ? <p className="mt-2 text-xs text-muted">{meta}</p> : null}
    </div>
  );
}
