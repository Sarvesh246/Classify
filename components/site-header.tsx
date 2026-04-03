import Link from "next/link";
import { Search } from "lucide-react";
import { ClassifyLogo } from "@/components/classify-logo";
import { cn } from "@/lib/utils";

interface SiteHeaderProps {
  tone?: "home" | "app";
}

export function SiteHeader({ tone = "app" }: SiteHeaderProps) {
  const isHome = tone === "home";

  return (
    <header
      className={cn(
        "sticky top-0 z-[60] border-b backdrop-blur-xl",
        isHome
          ? "border-white/10 bg-deep-ink/34 text-ivory"
          : "border-border/70 bg-background/84 text-ink",
      )}
    >
      <div className="section-shell flex min-h-18 items-center justify-between gap-4 py-4">
        <Link href="/" aria-label="Classify home">
          <ClassifyLogo />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
          <Link href="/search" className="transition hover:text-teal">
            Search
          </Link>
          <Link href="/compare" className="transition hover:text-teal">
            Compare
          </Link>
          <Link href="/methodology" className="transition hover:text-teal">
            Methodology
          </Link>
          <Link href="/search?q=UT" className="transition hover:text-teal">
            Schools
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
              isHome
                ? "glass-line text-ivory hover:bg-white/12"
                : "border border-border bg-white/60 hover:bg-white",
            )}
          >
            <Search className="h-4 w-4" />
            Search
          </Link>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium",
              isHome
                ? "bg-ivory text-deep-ink"
                : "bg-deep-ink text-ivory",
            )}
          >
            No login required
          </span>
        </div>
      </div>
    </header>
  );
}
