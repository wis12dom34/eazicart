export function xml(value: string): string {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );
}
export function sitemapIndex(urls: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<sitemap><loc>${xml(url)}</loc></sitemap>`).join("")}</sitemapindex>`;
}
export function urlSet(urls: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from(
    new Set(urls),
  )
    .map((url) => `<url><loc>${xml(url)}</loc></url>`)
    .join("")}</urlset>`;
}
export const xmlHeaders = {
  "Content-Type": "application/xml; charset=utf-8",
  "X-Robots-Tag": "noindex",
  "Cache-Control": "no-store",
};
