import type { Product } from "./api/types";
import { canonicalUrl, safeImageUrl } from "./seo";

export function productSchema(product: Product) {
  const url = canonicalUrl(`/product/${encodeURIComponent(product.id)}`);
  if (!url || product.active === false) return undefined;
  const images = product.images
    .map((image) => safeImageUrl(image.url))
    .filter(Boolean);
  // NGN is the existing commerce currency (API checkout/payment schema).
  const validPrice = /^\d+(\.\d{1,2})?$/.test(product.price);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: images.length ? images : undefined,
    category: product.category.name,
    url,
    offers: validPrice
      ? {
          "@type": "Offer",
          url,
          price: product.price,
          priceCurrency: "NGN",
          availability:
            product.stock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          seller: {
            "@type": "Organization",
            name: product.seller.displayName,
            url: canonicalUrl(
              `/seller/${encodeURIComponent(product.seller.id)}`,
            ),
          },
        }
      : undefined,
  };
}

export function breadcrumbs(items: Array<{ name: string; path: string }>) {
  if (!canonicalUrl("/landing")) return undefined;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}
