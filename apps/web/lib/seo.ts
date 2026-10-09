import type { Metadata } from "next";

export const brandDescription =
  "EaziCart helps modern businesses manage products, orders, customers and online selling from one commerce platform.";

// Only an operator-verified origin may identify production canonical URLs.
export function siteOrigin(): string | undefined {
  const configured = process.env.EAZICART_SITE_URL;
  if (!configured) return undefined;
  try {
    const url = new URL(configured);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function publicIndexingEnabled(): boolean {
  return (
    Boolean(siteOrigin()) &&
    process.env.EAZICART_INDEXING === "true" &&
    (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production")
  );
}

export function catalogIndexingEnabled(): boolean {
  return (
    publicIndexingEnabled() && process.env.EAZICART_CATALOG_INDEXING === "true"
  );
}

export function canonicalUrl(path: string): string | undefined {
  const origin = siteOrigin();
  return origin ? new URL(path, origin).href : undefined;
}

export function safeImageUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, siteOrigin());
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function pageMetadata(
  title: string,
  description: string,
  path: string,
  options: { index?: boolean; image?: string; catalog?: boolean } = {},
): Metadata {
  const url = canonicalUrl(path);
  const image = safeImageUrl(options.image);
  const index =
    options.index !== false &&
    (options.catalog ? catalogIndexingEnabled() : publicIndexingEnabled());
  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    robots: { index, follow: true },
    openGraph: {
      title: `${title} | EaziCart`,
      description,
      siteName: "EaziCart",
      type: "website",
      url,
      images: image ? [{ url: image, alt: title }] : [],
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${title} | EaziCart`,
      description,
      images: image ? [image] : [],
    },
  };
}

export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
