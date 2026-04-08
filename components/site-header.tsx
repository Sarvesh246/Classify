import { Suspense } from "react";
import { HeaderBackButton } from "@/components/header-back-button";
import { MobileRouteBar } from "@/components/mobile/mobile-route-bar";
import { SiteHeaderInner } from "@/components/site-header-inner";

interface SiteHeaderProps {
  tone?: "home" | "app";
}

/** Server Component: Suspense boundaries here satisfy Cache Components / `usePathname()` rules. */
export function SiteHeader({ tone = "app" }: SiteHeaderProps) {
  const isHome = tone === "home";

  return (
    <>
      <Suspense fallback={null}>
        <MobileRouteBar tone={tone} />
      </Suspense>
      <SiteHeaderInner
        tone={tone}
        backSlot={
          <Suspense fallback={null}>
            <HeaderBackButton
              tone={isHome ? "home" : "app"}
              className="hidden md:inline-flex"
            />
          </Suspense>
        }
      />
    </>
  );
}
