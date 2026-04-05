import { cn } from "@/lib/utils";

const TONE_STYLES = {
  /** Cream / off-white page backgrounds */
  light: [
    "bg-teal",
    "bg-copper",
    "bg-teal/85",
    "bg-deep-ink/45",
    "bg-copper/75",
  ],
  /** Dark fills (search chip, hero glass) */
  onDark: [
    "bg-ivory",
    "bg-teal",
    "bg-ivory/85",
    "bg-copper",
    "bg-ivory/70",
  ],
} as const;

const SIZE_STYLES = {
  sm: { wrap: "h-9 gap-1", barW: "w-1.5", heights: [14, 24, 30, 20, 26] },
  md: { wrap: "h-12 gap-[5px]", barW: "w-2", heights: [18, 32, 40, 24, 34] },
  lg: { wrap: "h-16 gap-1.5", barW: "w-2.5", heights: [24, 42, 52, 32, 44] },
} as const;

type ClassifyLoadingMarkProps = {
  /** `light` = default app pages; `onDark` = deep-ink or glass headers */
  tone?: keyof typeof TONE_STYLES;
  size?: keyof typeof SIZE_STYLES;
  className?: string;
  label?: string;
};

/**
 * Histogram-style motion — reads as “distribution / classification” — not a circular spinner.
 */
export function ClassifyLoadingMark({
  tone = "light",
  size = "md",
  className,
  label = "Loading",
}: ClassifyLoadingMarkProps) {
  const spec = SIZE_STYLES[size];
  const colors = TONE_STYLES[tone];

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div
        className={cn("flex items-end justify-center", spec.wrap)}
        aria-hidden
      >
        {spec.heights.map((heightPx, i) => (
          <span
            key={i}
            className={cn(
              "classify-load-bar shrink-0 rounded-full",
              spec.barW,
              colors[i % colors.length],
            )}
            style={{
              height: heightPx,
              animationDelay: `${i * 95}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
