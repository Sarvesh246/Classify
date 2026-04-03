import { formatCoverageTier } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { type CoverageTier } from "@/lib/types";

const toneMap: Record<CoverageTier, string> = {
  institutional_plus_rmp:
    "border-teal/40 bg-teal/12 text-deep-ink shadow-[inset_0_0_0_1px_rgba(88,199,184,0.18)]",
  institutional_only:
    "border-copper/45 bg-copper/12 text-deep-ink shadow-[inset_0_0_0_1px_rgba(201,138,87,0.18)]",
  rmp_only:
    "border-ink/12 bg-ink/6 text-ink/78 shadow-[inset_0_0_0_1px_rgba(7,17,31,0.08)]",
};

/** High-contrast text for badges on dark / glass panels (home hero, etc.) */
const toneMapOnDark: Record<CoverageTier, string> = {
  institutional_plus_rmp:
    "border-teal/55 bg-teal/25 text-ivory shadow-[inset_0_0_0_1px_rgba(88,199,184,0.4)]",
  institutional_only:
    "border-copper/50 bg-copper/28 text-ivory shadow-[inset_0_0_0_1px_rgba(201,138,87,0.38)]",
  rmp_only:
    "border-white/28 bg-white/14 text-ivory shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]",
};

export function CoverageBadge({
  tier,
  className,
  variant = "default",
}: {
  tier: CoverageTier;
  className?: string;
  variant?: "default" | "onDark";
}) {
  const tones = variant === "onDark" ? toneMapOnDark : toneMap;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-medium uppercase tracking-[0.16em]",
        tones[tier],
        className,
      )}
    >
      {formatCoverageTier(tier)}
    </span>
  );
}
