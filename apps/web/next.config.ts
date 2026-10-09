import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate screenshot runs from a developer's running Next server.
  devIndicators: false,
  distDir: process.env.EAZICART_TEST_DIST_DIR || ".next",
  poweredByHeader: false,
  // Resolve metadata before emitting HTML for reliable previews and 404 statuses.
  htmlLimitedBots: /.*/,
  reactStrictMode: true,
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
