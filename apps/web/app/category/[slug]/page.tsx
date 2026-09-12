"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { BottomNavigation } from "../../components/bottom-navigation";
import { DiscoveryProductCard } from "../../components/discovery-product-card";
import { Icon } from "../../components/icon";
import styles from "../../discovery.module.css";
import { useRequest } from "../../hooks/use-request";
import { categoriesApi } from "../../../lib/api/categories";
import { productsApi } from "../../../lib/api/products";

export default function CategoryPage() {
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

  const category = categories.data?.data.find((item) => item.slug === slug);
  const categoryName = category?.name ?? slug;
  const relatedCategories = (categories.data?.data ?? [])
    .filter((item) => item.slug !== slug)
    .slice(0, 4);
  const productRows = products.data?.data ?? [];
  const sellerRows = Array.from(
    new Map(
      productRows.map((product) => [product.seller.id, product.seller]),
    ).values(),
  ).slice(0, 4);
  const loading = categories.loading || products.loading;
  const error = categories.error || products.error;
  const categoryMissing = !categories.loading && !categories.error && !category;

  if (categoryMissing) {
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
          <h1 className={styles.title}>Category</h1>
        </header>
        <div className={styles.state}>
          <strong>Category not found</strong>
          Browse the current categories in Explore.
        </div>
        <BottomNavigation />
      </main>
    );
  }

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
        <h1 className={styles.title}>{categoryName}</h1>
      </header>

      <p className={styles.count} aria-live="polite">
        {loading
          ? "Loading products…"
          : `${products.data?.pagination.total ?? 0} products`}
      </p>

      <form
        className={styles.search}
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

      {error ? (
        <div className={styles.state} role="alert">
          <strong>Category is unavailable</strong>
          {error}
        </div>
      ) : null}

      {!error && relatedCategories.length > 0 ? (
        <section className={styles.section} aria-labelledby="browse-categories">
          <h2 id="browse-categories">Browse categories</h2>
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

      {!error && !loading ? (
        <section className={styles.section} aria-labelledby="category-products">
          <h2 id="category-products">
            {search
              ? `Results in ${categoryName}`
              : `Popular in ${categoryName}`}
          </h2>
          {productRows.length > 0 ? (
            <div className={styles.grid}>
              {productRows.map((product) => (
                <DiscoveryProductCard product={product} key={product.id} />
              ))}
            </div>
          ) : (
            <div className={styles.state}>
              <strong>No products found</strong>
              {search
                ? `No products in ${categoryName} match “${search}”.`
                : `There are no products in ${categoryName} yet.`}
            </div>
          )}
        </section>
      ) : null}

      {!error && sellerRows.length > 0 ? (
        <section className={styles.section} aria-labelledby="category-sellers">
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

      <BottomNavigation />
    </main>
  );
}
