import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate screenshot runs from a developer's running Next server.
  devIndicators: false,
  distDir: process.env.EAZICART_TEST_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@eazicart/ui"],
};

export default nextConfig;
