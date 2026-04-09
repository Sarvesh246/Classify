/** Browser-only localStorage keys and helpers for Classify client state. */

export const IOS_INSTALL_BANNER_DISMISSED_KEY = "classify:ios-install-banner-dismissed";

export const PLANNER_LOCAL_COURSE_PREFIX = "classly:my-courses:";

/**
 * Remove per-school planner URL/cache entries stored on this device only.
 * Does not delete Supabase shortlist or drafts when signed in.
 */
export function clearPlannerLocalCourseEntries(): number {
  if (typeof window === "undefined" || !window.localStorage) {
    return 0;
  }
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(PLANNER_LOCAL_COURSE_PREFIX)) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  return toRemove.length;
}

export function resetIosInstallBannerDismissed(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(IOS_INSTALL_BANNER_DISMISSED_KEY);
  } catch {
    /* ignore */
  }
}
