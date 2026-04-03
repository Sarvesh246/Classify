import { CoverageBadge } from "@/components/coverage-badge";
import { SiteHeader } from "@/components/site-header";
import { getFeaturedOfferings } from "@/lib/data";
import { getScoreBreakdown } from "@/lib/scoring";

export default function MethodologyPage() {
  const example = getFeaturedOfferings()[0];
  const breakdown = getScoreBreakdown({
    avgGpa: example.expectedGpa,
    aPct: example.aRate,
    rmpDifficulty: example.rmpDifficulty,
    rmpRating: example.rmpRating,
  });

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="page-shell pt-10">
        <section className="soft-panel rounded-[34px] p-6 sm:p-8">
          <p className="eyebrow">Methodology</p>
          <h1 className="app-page-title mt-3 font-semibold text-ink">
            Classify scores are weighted, transparent, and confidence-aware
          </h1>
          <p className="app-lead mt-4">
            Objective grade outcomes do most of the work. RMP still matters, but
            only as enrichment. When grade data is missing, Classify renormalizes
            the weights across the available signals instead of pretending missing
            data equals bad data.
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

          <div className="soft-panel rounded-[30px] p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <p className="eyebrow">Coverage tiers</p>
              <CoverageBadge tier="institutional_plus_rmp" />
              <CoverageBadge tier="rmp_only" />
            </div>
            <div className="mt-5 space-y-3 text-sm text-muted">
              <div className="rounded-[24px] border border-border/70 bg-white/72 px-4 py-4">
                <strong className="text-ink">Institutional + RMP</strong> means
                grade distributions and trend data exist, plus RMP enrichment.
              </div>
              <div className="rounded-[24px] border border-border/70 bg-white/72 px-4 py-4">
                <strong className="text-ink">Institutional only</strong> is
                reserved for schools where grade data exists but RMP matching is
                disabled or unavailable.
              </div>
              <div className="rounded-[24px] border border-border/70 bg-white/72 px-4 py-4">
                <strong className="text-ink">RMP only</strong> means the profile
                remains searchable, but GPA and A-rate cards explicitly show as
                unavailable.
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
            <CoverageBadge tier={example.coverageTier} />
          </div>
          <div className="mt-6 space-y-3">
            {breakdown.map((row) => (
              <div key={row.key} className="rounded-[24px] border border-border/70 bg-white/72 p-4">
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
