"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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
    <motion.nav
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="safe-bottom-pad fixed inset-x-0 bottom-0 z-[70] border-t border-border/70 bg-background/88 shadow-[0_-14px_40px_rgba(7,17,31,0.08)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-2 px-3 pt-2">
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
                "relative flex min-h-[3.55rem] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[1.35rem] px-1 py-1",
                active ? "!text-ivory" : "text-muted",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active ? (
                <motion.span
                  layoutId="mobile-nav-pill"
                  className="absolute inset-0 rounded-[1.35rem] bg-deep-ink shadow-[0_12px_30px_rgba(8,25,44,0.28)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                />
              ) : null}
              <motion.span
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 520, damping: 28 }}
                className={cn(
                  "relative z-10 flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.15rem] px-2 py-2 text-[0.72rem] font-medium",
                  active && "!text-ivory",
                  !active && "transition-colors duration-200 hover:bg-white/78 hover:text-ink",
                )}
              >
                <motion.span
                  animate={{
                    y: active ? -1.5 : 0,
                    scale: active ? 1.08 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                  className={cn(active && "!text-ivory")}
                >
                  <Icon className="h-4 w-4" />
                </motion.span>
                <motion.span
                  animate={{
                    opacity: active ? 1 : 0.82,
                    y: active ? -0.5 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className={cn(active && "!text-ivory")}
                >
                  {item.label}
                </motion.span>
              </motion.span>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
