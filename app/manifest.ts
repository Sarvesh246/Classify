import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Classify",
    short_name: "Classify",
    description:
      "Professor and course intelligence with grade outcomes, trend data, and transparent coverage tiers.",
    id: "/?source=pwa",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#f6f1e8",
    theme_color: "#08192c",
    icons: [
      {
        src: "/pwa/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/pwa/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
