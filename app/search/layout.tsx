import type { ReactNode } from "react";

/**
 * Layout is a thin passthrough: `await connection()` already runs on `page.tsx`.
 * Duplicating it here added an extra await on every `/search` navigation with no benefit.
 */
export default function SearchLayout({ children }: { children: ReactNode }) {
  return children;
}
