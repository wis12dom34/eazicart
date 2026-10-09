import {
  canonicalUrl,
  publicIndexingEnabled,
  catalogIndexingEnabled,
} from "../../lib/seo";
import { getPublicProducts } from "../../lib/public-catalog";
import { sitemapIndex, xmlHeaders } from "../../lib/sitemap-xml";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!publicIndexingEnabled())
    return new Response(sitemapIndex([]), { headers: xmlHeaders });
  const urls = [canonicalUrl("/sitemap.xml")!];
  if (catalogIndexingEnabled()) {
    const result = await getPublicProducts("limit=100&page=1");
    if (result.status !== "ok")
      return new Response("Catalog temporarily unavailable", {
        status: 503,
        headers: { "Retry-After": "300", "X-Robots-Tag": "noindex" },
      });
    // One API page per sitemap request; no full-catalog fetch during builds.
    const pages = result.data.pagination.pages;
    if (!Number.isSafeInteger(pages) || pages < 0 || pages > 49999)
      return new Response("Catalog sitemap requires partitioning", {
        status: 503,
      });
    for (let page = 1; page <= pages; page++)
      urls.push(canonicalUrl(`/catalog-sitemap/${page}.xml`)!);
  }
  return new Response(sitemapIndex(urls), { headers: xmlHeaders });
}
