"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { emitPerformanceEvent, endClientMeasure } from "@/lib/client-performance";

const ROUTE_TRANSITION_KEY = "route-transition";

export function WebVitalsReporter() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    void emitPerformanceEvent(`web_vital_${metric.name.toLowerCase()}`, metric.value, {
      rating: metric.rating,
      nav_type: metric.navigationType,
    });
  });

  useEffect(() => {
    void endClientMeasure(ROUTE_TRANSITION_KEY, { pathname });
  }, [pathname]);

  return null;
}
