import type { MetadataRoute } from "next";
import { canonicalUrl, publicIndexingEnabled } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  // Utility pages remain crawlable so crawlers can read their noindex metadata.
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/_next/data/"] },
    sitemap: publicIndexingEnabled()
      ? canonicalUrl("/sitemap-index.xml")
      : undefined,
  };
}
