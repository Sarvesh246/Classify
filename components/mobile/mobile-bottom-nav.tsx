"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
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
  const reduceMotion = useReducedMotion();

  return (
    <motion.nav
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      className="safe-bottom-pad fixed inset-x-0 bottom-0 z-[70] border-t border-border-strong bg-surface-strong/95 shadow-[0_-14px_44px_rgba(7,17,31,0.1)] backdrop-blur-xl dark:shadow-[0_-14px_44px_rgba(0,0,0,0.45)] md:hidden"
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
              prefetch
              className={cn(
                "relative flex min-h-[3.55rem] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[1.35rem] px-1 py-1",
                active ? "!text-ivory" : "text-muted",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active ? (
                reduceMotion ? (
                  <span className="absolute inset-0 rounded-[1.35rem] bg-deep-ink shadow-[0_12px_30px_rgba(8,25,44,0.28)]" />
                ) : (
                  <motion.span
                    layoutId="mobile-nav-pill"
                    className="absolute inset-0 rounded-[1.35rem] bg-deep-ink shadow-[0_12px_30px_rgba(8,25,44,0.28)]"
                    transition={{
                      type: "spring",
                      stiffness: 720,
                      damping: 38,
                      mass: 0.65,
                    }}
                  />
                )
              ) : null}
              <motion.span
                whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                transition={{ type: "spring", stiffness: 520, damping: 28 }}
                className={cn(
                  "relative z-10 flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.15rem] px-2 py-2 text-[0.72rem] font-medium",
                  active && "!text-ivory",
                  !active &&
                    "transition-colors duration-200 hover:bg-surface-raised-top/90 hover:text-ink dark:hover:bg-white/10",
                )}
              >
                <motion.span
                  animate={
                    reduceMotion
                      ? { y: 0, scale: 1 }
                      : {
                          y: active ? -1.5 : 0,
                          scale: active ? 1.08 : 1,
                        }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 620, damping: 32 }
                  }
                  className={cn(active && "!text-ivory")}
                >
                  <Icon className="h-4 w-4" />
                </motion.span>
                <motion.span
                  animate={
                    reduceMotion
                      ? { opacity: active ? 1 : 0.82, y: 0 }
                      : {
                          opacity: active ? 1 : 0.82,
                          y: active ? -0.5 : 0,
                        }
                  }
                  transition={
                    reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 28 }
                  }
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
