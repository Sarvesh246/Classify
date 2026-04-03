import { cn } from "@/lib/utils";

interface ClassifyLogoProps {
  compact?: boolean;
  className?: string;
}

export function ClassifyLogo({
  compact = false,
  className,
}: ClassifyLogoProps) {
  return (
    <div className={cn("flex items-center gap-3 text-current", className)}>
      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[16px] border border-white/20 bg-deep-ink shadow-[0_20px_60px_rgba(7,17,31,0.35)]">
        <svg
          aria-hidden="true"
          viewBox="0 0 48 48"
          className="h-9 w-9 text-ivory"
          fill="none"
        >
          <path
            d="M34.7 12.6C31.9 9.3 28.2 7.6 23.6 7.6C14.6 7.6 8.2 14.5 8.2 24C8.2 33.5 14.6 40.4 23.9 40.4C28.1 40.4 31.7 39 34.6 35.9"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <path
            d="M31.8 16.2C29.8 13.8 27.2 12.7 23.9 12.7C17.3 12.7 12.7 17.6 12.7 24C12.7 30.6 17.1 35.3 23.7 35.3C26.6 35.3 29.2 34.3 31.3 32.2"
            stroke="currentColor"
            strokeOpacity="0.62"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="34.6" cy="12.5" r="2.2" fill="#58C7B8" />
          <circle cx="31.5" cy="32.2" r="1.8" fill="#C98A57" />
        </svg>
      </div>
      {!compact ? (
        <div className="flex flex-col">
          <span className="display-title text-[1.15rem] font-semibold tracking-[-0.08em] text-current">
            Classify
          </span>
          <span
            className="-mt-0.5 text-[0.68rem] uppercase tracking-[0.24em]"
            style={{ opacity: 0.68 }}
          >
            Course Intelligence
          </span>
        </div>
      ) : null}
    </div>
  );
}
