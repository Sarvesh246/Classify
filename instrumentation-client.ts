import { startClientMeasure } from "@/lib/client-performance";

const ROUTE_TRANSITION_KEY = "route-transition";

try {
  performance.mark("classify_app_boot");
} catch {
  // ignore unsupported browsers
}

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
) {
  startClientMeasure(ROUTE_TRANSITION_KEY, "route_transition_duration", {
    url,
    navigation_type: navigationType,
  });
}
