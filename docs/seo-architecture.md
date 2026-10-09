# EaziCart SEO implementation

The existing customer Home and authentication architecture remain intact. `/landing` is the acquisition page; `/social-commerce` and `/online-store` explain implemented features. Illustrative landing imagery is labeled and never used as catalog structured data.

## Route policy

Public acquisition routes have unique titles, descriptions and semantic content. Product, seller and category pages render public API data on the server before hydration. Missing records return 404; unavailable APIs render useful unavailable states without inventing records. Query filters, empty categories, private areas, search, Reels and the customer Home are noindex. Seller aliases redirect to the profile ID. Category pagination has self-referencing URLs.

Public DTOs whitelist fields and exclude private user and supplier details. Existing client controls and request hooks remain in place. Offers use actual NGN prices and stock; no ratings, discounts or sales counts are invented. Structured data escapes unsafe script characters.

## Production activation

Set `EAZICART_SITE_URL` to a verified HTTPS production origin, `EAZICART_PUBLIC_API_URL` to the reachable public catalog API, and `EAZICART_INDEXING=true` only after verification. Set `EAZICART_CATALOG_INDEXING=true` separately only when the catalog is real and ready. Preview deployments remain noindex regardless of flags. No origin is guessed.

The associated `eazicart.vercel.app` domain returned deployment-not-found during this audit. A usable production deployment and public catalog could not be verified. Do not activate indexing based on the associated domain alone.

Robots allows crawling to read noindex directives and keeps assets accessible. The sitemap index includes the static sitemap and paginated catalog sitemaps only when enabled. Catalog requests fetch 100 records per page; outages return 503 with Retry-After, and missing pages return 404. Sitemaps exclude private and empty pages; no fabricated last-modified dates are emitted.

## Verification and remaining work

Repository build, lint, type checking and formatting passed. Unit tests: 68 passed. `node scripts/verify-seo.mjs` builds an isolated fixture-backed instance and verifies 28 raw HTML routes plus the seller alias redirect. Fixtures are test-only, never inserted into a database or published as products.

Browser installation failed locally. No real mobile-browser, authenticated checkout, production database, Search Console or field performance results are claimed. Validate production API reachability, redirects, image loading, mobile layouts and authenticated flows before release. Submit the production sitemap in Search Console after activation. Search Console, analytics, conversion tracking and real Core Web Vitals are data unavailable—needs verification.

| Audit area              | Implementation or status                                                      |
| ----------------------- | ----------------------------------------------------------------------------- |
| 1. Current architecture | Existing Next.js frontend, Fastify/Prisma backend and navigation preserved    |
| 2. Production domain    | Associated domain found; usable production unavailable                        |
| 3. Indexing policy      | Explicit production and catalog gates; previews noindex                       |
| 4. Public acquisition   | Landing plus two factual feature pages                                        |
| 5. Metadata             | Unique titles, descriptions, OG and Twitter metadata                          |
| 6. Canonicals           | Verified configured origin only; pagination self-references                   |
| 7. Server rendering     | Product, seller and category data in initial HTML                             |
| 8. Error states         | Genuine 404s; useful API outage states                                        |
| 9. Products             | Actual names, descriptions, prices, images and stock                          |
| 10. Sellers             | Public profile fields only; ID alias redirects                                |
| 11. Categories          | Existing categories, pagination and populated related links                   |
| 12. Structured data     | Product/Offer, breadcrumbs, organization/site and collections where justified |
| 13. Robots              | Private pages can be crawled to read noindex; assets allowed                  |
| 14. Sitemaps            | Gated static and paginated catalog XML; outage handling                       |
| 15. Internal links      | Existing navigation plus contextual acquisition/category links                |
| 16. Content quality     | Factual content and FAQ; no thin generated catalog pages                      |
| 17. Images/performance  | Responsive landing images, hero preload, intrinsic dimensions                 |
| 18. Privacy/security    | Public DTO whitelist and safe JSON-LD serialization                           |
| 19. Validation          | Build/lint/types/format, 68 unit tests, 28 raw HTML route checks              |
| 20. Measurement         | Search Console, analytics, real conversions and field vitals unverified       |
