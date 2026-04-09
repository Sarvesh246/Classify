import Link from "next/link";
import { cn, formatCoverageTier } from "@/lib/utils";
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
  methodologyLink = true,
}: {
  tier: CoverageTier;
  className?: string;
  variant?: "default" | "onDark";
  /** When true, the badge links to Methodology (coverage tiers section). Set false on the methodology page. */
  methodologyLink?: boolean;
}) {
  const tones = variant === "onDark" ? toneMapOnDark : toneMap;
  const label = formatCoverageTier(tier);
  const tip = `${label} — how Classify defines coverage tiers (Methodology).`;

  const badgeClass = cn(
    "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-[0.72rem] font-medium uppercase tracking-[0.16em]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-deep-ink",
    tones[tier],
    methodologyLink && "transition hover:opacity-95",
    className,
  );

  if (methodologyLink) {
    return (
      <Link
        href="/methodology#coverage-tiers"
        className={cn(badgeClass, "no-underline")}
        title={tip}
        aria-label={tip}
      >
        {label}
      </Link>
    );
  }

  return (
    <span className={badgeClass} title={tip}>
      {label}
    </span>
  );
}
