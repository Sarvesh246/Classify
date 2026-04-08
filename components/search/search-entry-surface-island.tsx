"use client";

import dynamic from "next/dynamic";
import { SearchEntrySurfaceSkeleton } from "@/components/search/search-entry-surface-skeleton";

export const SearchEntrySurfaceIsland = dynamic(
  () =>
    import("@/components/search/search-entry-surface").then((mod) => mod.SearchEntrySurface),
  {
    ssr: false,
    loading: () => <SearchEntrySurfaceSkeleton />,
  },
);
