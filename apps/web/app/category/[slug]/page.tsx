"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { BottomNavigation } from "../../components/bottom-navigation";
import { DiscoveryProductCard } from "../../components/discovery-product-card";
import { Icon } from "../../components/icon";
import styles from "../../discovery.module.css";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
import { categoriesApi } from "../../../lib/api/categories";
import { productsApi } from "../../../lib/api/products";
import { savedApi } from "../../../lib/api/saved";

export default function CategoryPage() {
  const auth = useAuth();
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = decodeURIComponent(params.slug);
  const search = searchParams.get("search")?.trim() ?? "";

  const categories = useRequest(() => categoriesApi.list(), []);
  const products = useRequest(
    () =>
      productsApi.list({
        category: slug,
        search: search || undefined,
        limit: 20,
      }),
    [slug, search],
  );
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

  const category = categories.data?.data.find((item) => item.slug === slug);
  const categoryName = category?.name ?? slug;
  const relatedCategories = (categories.data?.data ?? [])
    .filter((item) => item.slug !== slug)
    .slice(0, 4);
  const productRows = products.data?.data ?? [];
  const productColumns = [0, 1].map((column) =>
    productRows
      .map((product, index) => ({ product, index }))
      .filter(({ index }) => index % 2 === column),
  );
  const sellerRows = Array.from(
    new Map(
      productRows.map((product) => [product.seller.id, product.seller]),
    ).values(),
  ).slice(0, 4);
  const loading = categories.loading || products.loading;
  const loadError = categories.error || products.error;
  const categoryMissing = !categories.loading && !categories.error && !category;

  const retryLoad = () => {
    setSaveError("");
    void Promise.all([categories.reload(), products.reload()]);
  };

  const toggleSaved = async (productId: string, selected: boolean) => {
    if (!auth.isAuthenticated) {
      const next = `/category/${encodeURIComponent(slug)}${search ? `?search=${encodeURIComponent(search)}` : ""}`;
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
    } catch (caught) {
      setSaveError(
        caught instanceof Error
          ? caught.message
          : "Unable to update saved products",
      );
    } finally {
      setSavingId(null);
    }
  };

  if (categoryMissing) {
    return (
      <main className={`app-shell ${styles.categoryPage}`}>
        <div className={styles.categoryViewport}>
          <header className={styles.categoryHeader}>
            <Link
              className={styles.categoryBack}
              href="/explore"
              aria-label="Back to Explore"
            >
              <Icon name="back" size={22} />
            </Link>
            <h1>Category</h1>
          </header>
          <div className={styles.categoryState}>
            <strong>Category not found</strong>
            <p>Browse the current categories in Explore.</p>
            <Link className="state-action" href="/explore">
              Browse categories
            </Link>
          </div>
        </div>
        <BottomNavigation />
      </main>
    );
  }

  return (
    <main
      className={`app-shell ${styles.categoryPage}`}
      data-figma-node="31:50"
    >
      <div className={styles.categoryViewport} aria-busy={loading}>
        <header className={styles.categoryHeader}>
          <Link
            className={styles.categoryBack}
            href="/explore"
            aria-label="Back to Explore"
          >
            <Icon name="back" size={22} />
          </Link>
          <h1>{categoryName}</h1>
        </header>

        <p className={styles.categoryCount} aria-live="polite">
          {loading
            ? "Loading products…"
            : loadError
              ? "Products unavailable"
              : `${products.data?.pagination.total ?? 0} products`}
        </p>

        <form
          className={styles.categorySearch}
          action={`/category/${encodeURIComponent(slug)}`}
        >
          <Icon name="search" size={17} />
          <input
            key={search}
            name="search"
            defaultValue={search}
            aria-label={`Search ${categoryName}`}
            placeholder={`Search ${categoryName}`}
          />
        </form>

        {loading ? (
          <div className={styles.categoryState} role="status">
            <strong>Loading {categoryName}</strong>
            Getting the latest products and sellers…
          </div>
        ) : loadError ? (
          <div className={styles.categoryState} role="alert">
            <strong>Category is unavailable</strong>
            <p>
              We could not load this category. Check your connection and try
              again.
            </p>
            <button className="error-retry" type="button" onClick={retryLoad}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !loadError && relatedCategories.length > 0 ? (
          <section
            className={styles.categorySection}
            aria-labelledby="browse-categories"
          >
            <h2 id="browse-categories">Shop by category</h2>
            <div className={styles.categoryGrid}>
              {relatedCategories.map((item) => (
                <Link
                  className={styles.categoryCard}
                  href={`/category/${item.slug}`}
                  key={item.id}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {!loadError && !loading ? (
          <section
            className={`${styles.categorySection} ${styles.categoryProducts}`}
            aria-labelledby="category-products"
          >
            <h2 id="category-products">
              {search
                ? `Results in ${categoryName}`
                : `Popular in ${categoryName}`}
            </h2>
            {productRows.length > 0 ? (
              <div className={styles.categoryMasonry}>
                {productColumns.map((column, columnIndex) => (
                  <div
                    className={styles.categoryMasonryColumn}
                    key={columnIndex}
                  >
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
            ) : (
              <div className={styles.categoryState}>
                <strong>No products found</strong>
                <p>
                  {search
                    ? `No products in ${categoryName} match “${search}”.`
                    : `There are no products in ${categoryName} yet.`}
                </p>
                {search ? (
                  <Link
                    className="state-action"
                    href={`/category/${encodeURIComponent(slug)}`}
                  >
                    Clear search
                  </Link>
                ) : (
                  <Link className="state-action" href="/explore">
                    Explore products
                  </Link>
                )}
              </div>
            )}
          </section>
        ) : null}

        {!loadError && !loading && sellerRows.length > 0 ? (
          <section
            className={`${styles.categorySection} ${styles.categorySellerSection}`}
            aria-labelledby="category-sellers"
          >
            <h2 id="category-sellers">Sellers in {categoryName}</h2>
            <div className={styles.sellers}>
              {sellerRows.map((seller) => (
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
          <p className={styles.categorySaveError} role="alert">
            {saveError}
          </p>
        ) : null}

        <div className={styles.categoryScrollClearance} aria-hidden="true" />
      </div>

      <BottomNavigation />
    </main>
  );
}
