"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { emitPerformanceEvent } from "@/lib/client-performance";

export function WebVitalsReporter() {
  const pathname = usePathname();
  const pathTransitionRef = useRef<{ path: string; at: number } | null>(null);

  useReportWebVitals((metric) => {
    void emitPerformanceEvent(`web_vital_${metric.name.toLowerCase()}`, metric.value, {
      rating: metric.rating,
      nav_type: metric.navigationType,
    });
  });

  useEffect(() => {
    const prev = pathTransitionRef.current;
    const now = performance.now();
    if (prev) {
      void emitPerformanceEvent("client_route_transition", now - prev.at, {
        from_path: prev.path,
        to_path: pathname,
      });
    }
    pathTransitionRef.current = { path: pathname, at: now };
  }, [pathname]);

  return null;
}
