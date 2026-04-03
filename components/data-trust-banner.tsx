import {
  dataTrustSummaryLine,
  isSmallSample,
} from "@/lib/data-trust";
import type { ProfessorCourseSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DataTrustBanner({
  offering,
  className,
}: {
  offering: ProfessorCourseSummary;
  className?: string;
}) {
  const small = isSmallSample(offering.sampleSize);

  return (
    <div
      className={cn(
        "rounded-[22px] border border-border/80 bg-deep-ink/[0.04] px-4 py-3 text-sm",
        className,
      )}
    >
      <p className="font-semibold text-ink">What this row is built from</p>
      <p className="mt-1.5 leading-relaxed text-muted">{dataTrustSummaryLine(offering)}</p>
      {small ? (
        <p
          className="mt-3 rounded-xl border border-copper/35 bg-copper/12 px-3 py-2 text-xs font-medium text-deep-ink"
          role="status"
        >
          Small sample: GPA, A-rate, and the estimated letter chart are directional—not exact rankings.
        </p>
      ) : null}
    </div>
  );
}
