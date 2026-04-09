import "server-only";

import { cacheLife } from "next/cache";

export function applyCacheLife(profile: "minutes" | "hours") {
  try {
    cacheLife(
      profile === "hours"
        ? { stale: 300, revalidate: 3_600, expire: 86_400 }
        : { stale: 60, revalidate: 600, expire: 3_600 },
    );
  } catch {
    // `cacheLife` is unavailable in unit tests and non-Next runtimes.
  }
}

/** Tighter cache for search APIs — fresher reads, still CDN-friendly on Vercel. */
export function applyCacheLifeSearch() {
  try {
    cacheLife({ stale: 20, revalidate: 120, expire: 3_600 });
  } catch {
    // `cacheLife` is unavailable in unit tests and non-Next runtimes.
  }
}
