/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import "./explore.css";
import { BottomNavigation } from "../components/bottom-navigation";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/async-state";
import { Icon } from "../components/icon";
import { money } from "../data";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import { categoriesApi } from "../../lib/api/categories";
import { productsApi } from "../../lib/api/products";
import { sellersApi } from "../../lib/api/sellers";

export function ExploreContent() {
  const auth = useAuth();
  const params = useSearchParams();
  const search = params.get("search") ?? "";
  const category = params.get("category") ?? "";
  const products = useRequest(
    () => productsApi.list({ search, category, limit: 8 }),
    [search, category],
  );
  const categories = useRequest(() => categoriesApi.list(), []);
  const sellers = useRequest(() => sellersApi.list(), []);
  const error = products.error || categories.error || sellers.error;
  const popularProducts = products.data?.data.slice(0, 2) ?? [];
  const trendingCategories = categories.data?.data.slice(0, 4) ?? [];
  const topSellers = sellers.data?.data.slice(0, 3) ?? [];

  return (
    <main className="app-shell with-nav figma-explore">
      <header className="figma-explore-header">
        <Link
          className="figma-explore-avatar"
          href={auth.isAuthenticated ? "/profile" : "/login"}
          aria-label="Profile"
        >
          {auth.user?.name?.slice(0, 1).toUpperCase() ?? ""}
        </Link>
        <Link
          className="figma-explore-logo"
          href="/"
          aria-label="EaziCart home"
        >
          <span aria-hidden="true">↗</span>
        </Link>
        <div className="figma-explore-actions">
          <Link href="/saved" aria-label="Saved products">
            <Icon name="heart" size={22} />
          </Link>
          <Link href="/cart" aria-label="Cart">
            <Icon name="bag" size={20} />
          </Link>
        </div>
      </header>

      <h1 className="figma-explore-title">Explore</h1>

      <form className="figma-explore-search" action="/search">
        <Icon name="search" size={16} />
        <input
          name="search"
          defaultValue={search}
          aria-label="Search products, brands and sellers"
          placeholder="Search"
        />
      </form>

      <nav className="figma-explore-browse" aria-label="Explore browse">
        <strong>Browse</strong>
        <div>
          <Link href="#categories">Categories</Link>
          <button
            type="button"
            disabled
            title="Brand browsing is not available yet."
          >
            Brands
          </button>
          <Link href="#sellers">Sellers</Link>
        </div>
      </nav>

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

      <section className="figma-explore-section" id="categories">
        <h2>Trending Now</h2>
        <div
          className="figma-explore-trending"
          aria-label="Trending categories"
        >
          {trendingCategories.map((item) => (
            <Link href={`/category/${item.slug}`} key={item.id}>
              {item.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="figma-explore-section figma-explore-products">
        <h2>Popular Products</h2>
        {products.loading ? (
          <LoadingState label="Loading products…" />
        ) : popularProducts.length ? (
          <div className="figma-explore-grid">
            {popularProducts.map((product) => (
              <article className="figma-explore-product" key={product.id}>
                <Link
                  className="figma-explore-product-media"
                  href={`/product/${product.id}`}
                  aria-label={`View ${product.name}`}
                >
                  {product.images[0] ? (
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].altText ?? product.name}
                    />
                  ) : null}
                </Link>
                <Link
                  className="figma-explore-product-name"
                  href={`/product/${product.id}`}
                >
                  {product.name}
                </Link>
                <strong>{money(product.price)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="No products match your search." />
        )}
      </section>

      <section
        className="figma-explore-section figma-explore-sellers"
        id="sellers"
      >
        <div className="figma-explore-section-heading">
          <h2>Top Sellers</h2>
          <a href="#sellers">All sellers</a>
        </div>
        <div className="figma-explore-seller-row">
          {topSellers.map((seller) => (
            <Link href={`/seller/${seller.id}`} key={seller.id}>
              <span aria-hidden="true">
                {seller.displayName.slice(0, 2).toUpperCase()}
              </span>
              <strong>{seller.displayName}</strong>
            </Link>
          ))}
        </div>
      </section>

      <BottomNavigation />
    </main>
  );
}
