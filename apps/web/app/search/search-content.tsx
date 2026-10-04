/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { BottomNavigation } from "../components/bottom-navigation";
import { DiscoveryProductCard } from "../components/discovery-product-card";
import styles from "../discovery.module.css";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import { productsApi } from "../../lib/api/products";
import { savedApi } from "../../lib/api/saved";
import { sellersApi } from "../../lib/api/sellers";

function filterHref(search: string, filter?: "products" | "sellers") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (filter) params.set("filter", filter);
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

export function SearchContent() {
  const auth = useAuth();
  const router = useRouter();
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
  const saved = useRequest(
    () =>
      auth.isAuthenticated ? savedApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const normalizedSearch = search.toLowerCase();
  const sellerMatches = (sellers.data?.data ?? []).filter((seller) => {
    if (!normalizedSearch) return true;
    return [seller.displayName, seller.user?.name, seller.bio]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedSearch));
  });
  const productRows = products.data?.data ?? [];
  const productTotal = products.data?.pagination?.total ?? productRows.length;
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

  const productColumns = [0, 1].map((column) =>
    productRows
      .map((product, index) => ({ product, index }))
      .filter(({ index }) => index % 2 === column),
  );

  const toggleSaved = async (productId: string, selected: boolean) => {
    if (!auth.isAuthenticated) {
      const next = filterHref(search, filter === "all" ? undefined : filter);
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setSavingId(productId);
    setSaveError("");
    try {
      if (selected) await savedApi.remove(productId);
      else await savedApi.save(productId);
      setSavedOverrides((current) => ({
        ...current,
        [productId]: !selected,
      }));
    } catch (saveFailure) {
      setSaveError(
        saveFailure instanceof Error
          ? saveFailure.message
          : "Unable to update saved products",
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className={`app-shell ${styles.searchPage}`} data-figma-node="31:2">
      <header className={styles.searchHeader}>
        <Link
          className={styles.searchBack}
          href="/explore"
          aria-label="Back to Explore"
        >
          <span aria-hidden="true">
            <img src="/figma/back.svg" width={20} height={20} alt="" />
          </span>
        </Link>
        <h1>Search</h1>
      </header>

      <form className={styles.searchField} action="/search">
        <span aria-hidden="true">
          <img src="/figma/explore-search.svg" width={20} height={20} alt="" />
        </span>
        <input
          key={search}
          name="search"
          defaultValue={search}
          aria-label="Search products and sellers"
          placeholder="Search products and sellers"
        />
      </form>

      <p className={styles.searchCount} aria-live="polite">
        {loading ? "Searching…" : `${resultCount} results`}
      </p>

      <nav className={styles.searchFilters} aria-label="Search filters">
        <Link
          className={filter === "all" ? styles.searchFilterActive : undefined}
          href={filterHref(search)}
          aria-current={filter === "all" ? "page" : undefined}
        >
          All
        </Link>
        <Link
          className={
            filter === "products" ? styles.searchFilterActive : undefined
          }
          href={filterHref(search, "products")}
          aria-current={filter === "products" ? "page" : undefined}
        >
          Products
        </Link>
        <Link
          className={
            filter === "sellers" ? styles.searchFilterActive : undefined
          }
          href={filterHref(search, "sellers")}
          aria-current={filter === "sellers" ? "page" : undefined}
        >
          Sellers
        </Link>
        <span aria-disabled="true" title="Reel search is not available yet">
          Reels
        </span>
      </nav>

      <div className={styles.searchResultsViewport}>
        {error ? (
          <div className={styles.searchState} role="alert">
            <strong>Search is unavailable</strong>
            {error}
          </div>
        ) : !loading && !hasVisibleResults ? (
          <div className={styles.searchState}>
            <strong>No results found</strong>
            Try another product or seller name.
          </div>
        ) : null}

        {!error && showProducts && productRows.length > 0 ? (
          <section
            className={styles.searchSection}
            aria-labelledby="product-results"
          >
            <h2 id="product-results">Top results</h2>
            <div className={styles.searchMasonry}>
              {productColumns.map((column, columnIndex) => (
                <div className={styles.searchMasonryColumn} key={columnIndex}>
                  {column.map(({ product, index }) => {
                    const selected =
                      savedOverrides[product.id] ??
                      saved.data?.data.some(
                        (entry) => entry.productId === product.id,
                      ) ??
                      false;
                    return (
                      <DiscoveryProductCard
                        product={product}
                        key={product.id}
                        variant="search"
                        searchPosition={index}
                        saved={selected}
                        saving={savingId === product.id}
                        onToggleSaved={() =>
                          void toggleSaved(product.id, selected)
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!error && showSellers && sellerMatches.length > 0 ? (
          <section
            className={`${styles.searchSection} ${styles.searchSellerSection}`}
            aria-labelledby="seller-results"
          >
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

        {saveError ? (
          <p className={styles.searchSaveError} role="alert">
            {saveError}
          </p>
        ) : null}
      </div>

      <BottomNavigation />
    </main>
  );
}
