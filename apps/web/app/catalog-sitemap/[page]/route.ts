import { canonicalUrl, catalogIndexingEnabled } from "../../../lib/seo";
import { getPublicProducts } from "../../../lib/public-catalog";
import { urlSet, xmlHeaders } from "../../../lib/sitemap-xml";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params;
  if (!catalogIndexingEnabled() || !/^[1-9]\d*\.xml$/.test(page))
    return new Response("Not found", { status: 404 });
  const number = Number(page.slice(0, -4));
  if (!Number.isSafeInteger(number) || number > 49999)
    return new Response("Not found", { status: 404 });
  const result = await getPublicProducts(`limit=100&page=${number}`);
  if (result.status !== "ok")
    return new Response("Catalog temporarily unavailable", {
      status: 503,
      headers: { "Retry-After": "300", "X-Robots-Tag": "noindex" },
    });
  if (!result.data.data.length)
    return new Response("Not found", { status: 404 });
  const urls = result.data.data.flatMap((product) => [
    canonicalUrl(`/product/${encodeURIComponent(product.id)}`)!,
    canonicalUrl(`/seller/${encodeURIComponent(product.seller.id)}`)!,
  ]);
  return new Response(urlSet(urls), { headers: xmlHeaders });
}
