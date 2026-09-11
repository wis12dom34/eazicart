"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BottomNavigation } from "../components/bottom-navigation";
import { Header } from "../components/header";
import { Icon } from "../components/icon";
import { ProductGrid } from "../components/product-card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/async-state";
import { productsApi } from "../../lib/api/products";
import { sellersApi } from "../../lib/api/sellers";
import { categoriesApi } from "../../lib/api/categories";
import { useRequest } from "../hooks/use-request";

export function ExploreContent() {
  const params = useSearchParams();
  const search = params.get("search") ?? "";
  const category = params.get("category") ?? "";
  const products = useRequest(
    () => productsApi.list({ search, category, limit: 40 }),
    [search, category],
  );
  const categories = useRequest(() => categoriesApi.list(), []);
  const sellers = useRequest(() => sellersApi.list(), []);
  const error = products.error || categories.error || sellers.error;

  return (
    <main className="app-shell with-nav">
      <Header title="Explore" />
      <form className="search-bar">
        <Icon name="search" size={20} />
        <input
          name="search"
          defaultValue={search}
          aria-label="Search products, brands and sellers"
          placeholder="Search products, brands and sellers"
        />
        <button aria-label="Search">
          <Icon name="filter" size={20} />
        </button>
      </form>
      <div className="filter-tabs">
        <button className="active">Products</button>
        <Link href="#categories">Categories</Link>
        <Link href="#brands">Brands</Link>
        <Link href="#sellers">Sellers</Link>
      </div>
      {error && (
        <ErrorState
          message={error}
          retry={() => {
            void products.reload();
            void categories.reload();
            void sellers.reload();
          }}
        />
      )}
      <section className="section" id="categories">
        <div className="section-header">
          <h2>Browse categories</h2>
        </div>
        <div className="wide-cards">
          {categories.data?.data.map((x, i) => (
            <Link
              href={`?category=${encodeURIComponent(x.slug)}`}
              className="wide-card"
              key={x.id}
              style={{
                background: ["#e9ddd4", "#dce1df", "#e6e0d5", "#d8dfdc"][
                  i % 4
                ],
              }}
            >
              {x.name}
              <Icon name="chevron" size={18} />
            </Link>
          ))}
        </div>
      </section>
      <section className="section" id="brands">
        <div className="section-header">
          <h2>Featured brands</h2>
          <Link href="#sellers">See all</Link>
        </div>
        <div className="seller-row">
          {sellers.data?.data.map((s) => (
            <Link href={`/seller/${s.id}`} className="seller-chip" key={s.id}>
              <span>{s.displayName.slice(0, 2).toUpperCase()}</span>
              <strong>{s.displayName}</strong>
              <small>{s._count?.products ?? 0} products</small>
            </Link>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-header">
          <h2>Popular picks</h2>
        </div>
        {products.loading ? (
          <LoadingState />
        ) : products.data?.data.length ? (
          <ProductGrid products={products.data.data} />
        ) : (
          <EmptyState message="No products match your search." />
        )}
      </section>
      <BottomNavigation />
    </main>
  );
}
