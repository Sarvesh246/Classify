import { cn } from "@/lib/utils";
import { type TrendPoint } from "@/lib/types";

export function TrendSparkline({
  trend,
  className,
}: {
  trend: TrendPoint[];
  className?: string;
}) {
  const values = trend
    .map((point) => point.classifyScore)
    .filter((value): value is number => value != null);

  if (values.length < 2) {
    return (
      <div
        className={cn(
          "flex h-14 items-center rounded-2xl border border-border/80 bg-white/55 px-4 text-sm text-muted",
          className,
        )}
      >
        Trend unavailable
      </div>
    );
  }

  const width = 220;
  const height = 64;
  const min = Math.min(...values) - 3;
  const max = Math.max(...values) + 3;
  const pointString = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / (max - min || 1)) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-16 w-full overflow-visible", className)}
      role="img"
      aria-label="Trend sparkline"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#58C7B8" />
          <stop offset="100%" stopColor="#0B2442" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="url(#spark-fill)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pointString}
      />
      {values.map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - ((value - min) / (max - min || 1)) * height;
        return (
          <circle
            key={`${x}-${value}`}
            cx={x}
            cy={y}
            r="3.5"
            fill="#F6F1E8"
            stroke="#0B2442"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}
