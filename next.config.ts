import type { NextConfig } from "next";

/** RFC1918-style host patterns so `next dev` works when opened via LAN IP, not only localhost. */
const privateLanDevOrigins = [
  "localhost",
  "127.0.0.1",
  "192.168.*",
  "10.*",
  "172.16.*",
  "172.17.*",
  "172.18.*",
  "172.19.*",
  "172.20.*",
  "172.21.*",
  "172.22.*",
  "172.23.*",
  "172.24.*",
  "172.25.*",
  "172.26.*",
  "172.27.*",
  "172.28.*",
  "172.29.*",
  "172.30.*",
  "172.31.*",
] as const;

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "@floating-ui/react"],
  },
  // Dev-only (ignored in production): allow RSC / `/_next` / HMR when the site is opened via LAN IP, not localhost.
  allowedDevOrigins: [...privateLanDevOrigins],
};

export default nextConfig;
