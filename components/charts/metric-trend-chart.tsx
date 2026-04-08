import { cn } from "@/lib/utils";
import { type TrendPoint } from "@/lib/types";

type TrendMetric = "classifyScore" | "aPct" | "avgGpa";

const metricMeta: Record<
  TrendMetric,
  {
    label: string;
    format: (value: number) => string;
    min: number;
    max: number;
    bar: string;
  }
> = {
  classifyScore: {
    label: "Classify",
    format: (value) => `${Math.round(value)}`,
    min: 0,
    max: 100,
    bar: "bg-gradient-to-t from-deep-ink to-teal",
  },
  aPct: {
    label: "A-rate",
    format: (value) => `${Math.round(value)}%`,
    min: 0,
    max: 100,
    bar: "bg-gradient-to-t from-copper to-teal",
  },
  avgGpa: {
    label: "Expected GPA",
    format: (value) => value.toFixed(2),
    min: 0,
    max: 4,
    bar: "bg-gradient-to-t from-deep-ink to-copper",
  },
};

export function metricHasTrend(trend: TrendPoint[], metric: TrendMetric): boolean {
  return trend.filter((point) => point[metric] != null).length >= 2;
}

export function MetricTrendChart({
  trend,
  metric,
  className,
}: {
  trend: TrendPoint[];
  metric: TrendMetric;
  className?: string;
}) {
  const meta = metricMeta[metric];
  const filtered = trend.filter(
    (point) => point[metric] != null,
  ) as Array<TrendPoint & Record<TrendMetric, number>>;

  if (!metricHasTrend(trend, metric)) {
    return null;
  }

  return (
    <div className={cn("rounded-[24px] border border-border/70 bg-white/72 p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">{meta.label} trend</p>
        <p className="text-sm text-muted">
          Latest {meta.format(filtered.at(-1)?.[metric] ?? 0)}
        </p>
      </div>
      <div className="mt-5 grid h-40 grid-cols-[repeat(auto-fit,minmax(44px,1fr))] items-end gap-3">
        {filtered.map((point) => {
          const value = point[metric];
          const height = Math.max(
            ((value - meta.min) / Math.max(meta.max - meta.min, 1)) * 100,
            8,
          );

          return (
            <div key={`${metric}-${point.term}`} className="flex h-full flex-col justify-end">
              <div className="text-center text-[0.68rem] font-medium text-ink">
                {meta.format(value)}
              </div>
              <div className="mt-2 flex-1 rounded-[20px] bg-background p-1">
                <div
                  className={cn("w-full rounded-[16px]", meta.bar)}
                  style={{ height: `${height}%` }}
                />
              </div>
              <div className="mt-2 text-center text-[0.68rem] leading-4 text-muted">
                {point.term}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
