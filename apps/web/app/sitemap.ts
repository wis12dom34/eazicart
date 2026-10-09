import type { MetadataRoute } from "next";
import {
  canonicalUrl,
  publicIndexingEnabled,
  catalogIndexingEnabled,
} from "../lib/seo";
import { getPublicCategories } from "../lib/public-catalog";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!publicIndexingEnabled()) return [];
  const urls = ["/landing", "/social-commerce", "/online-store"];
  if (catalogIndexingEnabled()) {
    const categories = await getPublicCategories();
    if (categories.status === "ok")
      urls.push(
        ...categories.data
          .filter((c) => (c._count?.products ?? 0) > 0)
          .map((c) => `/category/${encodeURIComponent(c.slug)}`),
      );
  }
  return urls.map((path) => ({ url: canonicalUrl(path)! }));
}
