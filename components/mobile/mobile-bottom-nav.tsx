"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Scale, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/compare", label: "Compare", icon: Scale },
  { href: "/saved", label: "Saved", icon: Bookmark },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom-pad fixed inset-x-0 bottom-0 z-[70] border-t border-border/80 bg-background/92 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between px-3 pt-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[0.72rem] font-medium transition",
                active
                  ? "bg-deep-ink text-ivory"
                  : "text-muted hover:bg-white/80 hover:text-ink",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
