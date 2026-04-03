import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Classify",
    short_name: "Classify",
    description:
      "Professor and course intelligence with grade outcomes, trend data, and transparent coverage tiers.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e8",
    theme_color: "#08192c",
  };
}
