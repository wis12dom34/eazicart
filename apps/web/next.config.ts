import type { NextConfig } from "next";

const apiProxyTarget = process.env.EAZICART_PUBLIC_API_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Version every production asset request. This prevents iOS Safari from
  // combining long-lived JS/CSS from an older deployment with fresh HTML.
  deploymentId: "eazicart-20261018-01",
  // Isolate screenshot runs from a developer's running Next server.
  devIndicators: false,
  distDir: process.env.EAZICART_TEST_DIST_DIR || ".next",
  poweredByHeader: false,
  experimental: { proxyClientMaxBodySize: "60mb" },
  // Resolve metadata before emitting HTML for reliable previews and 404 statuses.
  htmlLimitedBots: /.*/,
  reactStrictMode: true,
  rewrites: () =>
    Promise.resolve(
      apiProxyTarget
        ? [
            {
              source: "/api/:path*",
              destination: `${apiProxyTarget}/:path*`,
            },
          ]
        : [],
    ),
  images: {
    // Product media is immutable for a year. Keep optimized variants equally
    // cacheable so repeat feed visits never pay the resize cost again.
    minimumCacheTTL: 31_536_000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "eazicart.com",
        pathname: "/api/products/media/**",
      },
      {
        protocol: "https",
        hostname: "eazicart.com",
        pathname: "/api/social/media/file/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-*",
      },
    ],
  },
  transpilePackages: ["@eazicart/ui"],
};

export default nextConfig;

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]