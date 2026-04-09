import { CoverageBadge } from "@/components/coverage-badge";
import { SiteHeader } from "@/components/site-header";
import { getFeaturedOfferings } from "@/lib/catalog";
import { getScoreBreakdown } from "@/lib/scoring";

export default async function MethodologyPage() {
  const example = (await getFeaturedOfferings())[0];
  const breakdown = getScoreBreakdown({
    avgGpa: example.expectedGpa,
    aPct: example.aRate,
    rmpDifficulty: example.rmpDifficulty,
    rmpRating: example.rmpRating,
    coverageTier: example.coverageTier,
  });

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10 pb-16 md:pb-10">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <p className="eyebrow">Methodology</p>
          <h1 className="app-page-title mt-3 font-semibold text-ink">
            Classify rankings are evidence-aware, transparent, and confidence-scored
          </h1>
          <p className="app-lead mt-4">
            Classify uses the same planning workflow for every school. When official
            grade data exists, it drives expected GPA, A-rate, and trends. When only
            lighter evidence exists, the product stays useful without pretending to
            have official certainty. Missing signals are renormalized so rows stay
            comparable without inventing precision.
          </p>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="soft-panel rounded-[30px] p-5 sm:p-6">
            <p className="eyebrow">Formula</p>
            <pre className="mt-4 overflow-x-auto rounded-[24px] bg-deep-ink p-5 text-sm leading-7 text-ivory">
{`score =
  GPA * 0.35 +
  A-rate * 0.35 +
  RMP ease * 0.20 +
  RMP quality * 0.10

When a signal is missing:
- drop that signal
- renormalize the remaining weights
- publish confidence separately`}
            </pre>
          </div>

          <div id="coverage-tiers" className="soft-panel scroll-mt-24 rounded-[var(--radius-card)] p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <p className="eyebrow">Evidence profiles</p>
              <CoverageBadge tier="institutional_plus_rmp" methodologyLink={false} />
              <CoverageBadge tier="institutional_only" methodologyLink={false} />
              <CoverageBadge tier="rmp_only" methodologyLink={false} />
            </div>
            <div className="mt-5 space-y-3 text-sm text-muted">
              <div className="rounded-[24px] classify-inner px-4 py-4">
                <strong className="text-ink">High evidence</strong> means official
                outcomes are present and may also be paired with RMP enrichment.
              </div>
              <div className="rounded-[24px] classify-inner px-4 py-4">
                <strong className="text-ink">Official data</strong> means Classify can
                still rank with institutional outcomes even if external enrichment is
                absent or intentionally disabled.
              </div>
              <div className="rounded-[24px] classify-inner px-4 py-4">
                <strong className="text-ink">Limited evidence</strong> means the
                school stays searchable and planner-ready, but grade outcomes are not
                yet published locally and reliability messaging stays softer.
              </div>
              <div className="rounded-[24px] classify-inner px-4 py-4">
                <strong className="text-ink">Planner readiness</strong> describes how
                much baseline structure is available: directory-ready, catalog-ready,
                or schedule-ready.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 soft-panel rounded-[30px] p-5 sm:p-6">
          <p className="eyebrow">Worked example</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold text-ink">{example.professorName}</h2>
              <p className="mt-1 text-sm text-muted">
                {example.courseCode} - {example.courseName}
              </p>
            </div>
            <CoverageBadge tier={example.coverageTier} methodologyLink={false} />
          </div>
          <div className="mt-6 space-y-3">
            {breakdown.map((row) => (
              <div key={row.key} className="rounded-[24px] classify-inner p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{row.label}</p>
                    <p className="text-sm text-muted">
                      Base weight {Math.round(row.baseWeight * 100)}% - Effective
                      weight {Math.round(row.effectiveWeight * 100)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted">
                      Normalized {row.normalized == null ? "N/A" : row.normalized.toFixed(2)}
                    </p>
                    <p className="font-semibold text-ink">
                      Contribution {row.contribution == null ? "N/A" : row.contribution}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
