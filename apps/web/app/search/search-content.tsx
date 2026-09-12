"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { BottomNavigation } from "../components/bottom-navigation";
import { DiscoveryProductCard } from "../components/discovery-product-card";
import { Icon } from "../components/icon";
import styles from "../discovery.module.css";
import { useRequest } from "../hooks/use-request";
import { productsApi } from "../../lib/api/products";
import { sellersApi } from "../../lib/api/sellers";

function filterHref(search: string, filter?: "products" | "sellers") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (filter) params.set("filter", filter);
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

export function SearchContent() {
  const params = useSearchParams();
  const search = params.get("search")?.trim() ?? "";
  const requestedFilter = params.get("filter");
  const filter =
    requestedFilter === "products" || requestedFilter === "sellers"
      ? requestedFilter
      : "all";

  const products = useRequest(
    () => productsApi.list({ search: search || undefined, limit: 20 }),
    [search],
  );
  const sellers = useRequest(() => sellersApi.list(), []);

  const normalizedSearch = search.toLowerCase();
  const sellerMatches = (sellers.data?.data ?? []).filter((seller) => {
    if (!normalizedSearch) return true;
    return [seller.displayName, seller.user?.name, seller.bio]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedSearch));
  });
  const productRows = products.data?.data ?? [];
  const productTotal = products.data?.pagination.total ?? 0;
  const resultCount =
    filter === "products"
      ? productTotal
      : filter === "sellers"
        ? sellerMatches.length
        : productTotal + sellerMatches.length;
  const loading = products.loading || sellers.loading;
  const error = products.error || sellers.error;
  const showProducts = filter !== "sellers";
  const showSellers = filter !== "products";
  const hasVisibleResults =
    (showProducts && productRows.length > 0) ||
    (showSellers && sellerMatches.length > 0);

  return (
    <main className={`app-shell with-nav ${styles.page}`}>
      <header className={styles.header}>
        <Link
          className={styles.back}
          href="/explore"
          aria-label="Back to Explore"
        >
          <Icon name="back" size={22} />
        </Link>
        <h1 className={styles.title}>Search</h1>
      </header>

      <p className={styles.count} aria-live="polite">
        {loading ? "Searching…" : `${resultCount} results`}
      </p>

      <form className={styles.search} action="/search">
        <Icon name="search" size={17} />
        <input
          key={search}
          name="search"
          defaultValue={search}
          aria-label="Search products and sellers"
          placeholder="Search products and sellers"
        />
      </form>

      <p className={styles.sectionLabel}>Filters</p>
      <nav className={styles.filters} aria-label="Search filters">
        <Link
          className={`${styles.filter} ${filter === "all" ? styles.filterActive : ""}`}
          href={filterHref(search)}
          aria-current={filter === "all" ? "page" : undefined}
        >
          All
        </Link>
        <Link
          className={`${styles.filter} ${filter === "products" ? styles.filterActive : ""}`}
          href={filterHref(search, "products")}
          aria-current={filter === "products" ? "page" : undefined}
        >
          Products
        </Link>
        <Link
          className={`${styles.filter} ${filter === "sellers" ? styles.filterActive : ""}`}
          href={filterHref(search, "sellers")}
          aria-current={filter === "sellers" ? "page" : undefined}
        >
          Sellers
        </Link>
        <span
          className={styles.disabledFilter}
          aria-disabled="true"
          title="Reel search is not available yet"
        >
          Reels
        </span>
      </nav>

      {error ? (
        <div className={styles.state} role="alert">
          <strong>Search is unavailable</strong>
          {error}
        </div>
      ) : !loading && !hasVisibleResults ? (
        <div className={styles.state}>
          <strong>No results found</strong>
          Try another product or seller name.
        </div>
      ) : null}

      {!error && showProducts && productRows.length > 0 ? (
        <section className={styles.section} aria-labelledby="product-results">
          <h2 id="product-results">Top results</h2>
          <div className={styles.grid}>
            {productRows.map((product) => (
              <DiscoveryProductCard product={product} key={product.id} />
            ))}
          </div>
        </section>
      ) : null}

      {!error && showSellers && sellerMatches.length > 0 ? (
        <section className={styles.section} aria-labelledby="seller-results">
          <h2 id="seller-results">Sellers</h2>
          <div className={styles.sellers}>
            {sellerMatches.map((seller) => (
              <Link
                className={styles.sellerRow}
                href={`/seller/${seller.id}`}
                key={seller.id}
              >
                <span className={styles.sellerAvatar} aria-hidden="true">
                  {seller.displayName.slice(0, 2).toUpperCase()}
                </span>
                <span className={styles.sellerText}>
                  <strong>{seller.displayName}</strong>
                  {seller.bio ? <small>{seller.bio}</small> : null}
                </span>
                <span className={styles.view}>View</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <BottomNavigation />
    </main>
  );
}
