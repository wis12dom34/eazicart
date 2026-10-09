import type { NextConfig } from "next";

const apiProxyTarget = process.env.EAZICART_PUBLIC_API_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Isolate screenshot runs from a developer's running Next server.
  devIndicators: false,
  distDir: process.env.EAZICART_TEST_DIST_DIR || ".next",
  poweredByHeader: false,
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
    remotePatterns: [
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
