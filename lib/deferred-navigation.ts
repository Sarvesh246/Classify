import { startTransition } from "react";

/**
 * Run App Router updates after the next frame inside a transition.
 * Mitigates Turbopack HMR races in Next.js 16 where `router.replace` / `router.push` during
 * refresh can throw "Router action dispatched before initialization."
 */
export function runDeferredNavigation(action: () => void): void {
  if (typeof window === "undefined") {
    action();
    return;
  }
  startTransition(() => {
    requestAnimationFrame(() => {
      action();
    });
  });
}
