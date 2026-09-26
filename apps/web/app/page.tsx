/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useMemo } from "react";

import "./home.css";
import { BottomNavigation } from "./components/bottom-navigation";
import { EmptyState, ErrorState, LoadingState } from "./components/async-state";
import { Icon } from "./components/icon";
import { money } from "./data";
import { useRequest } from "./hooks/use-request";
import { useAuth } from "./providers/auth-provider";
import { productsApi } from "../lib/api/products";
import type { Product } from "../lib/api/types";

type SellerGroup = {
  id: string;
  userId: string;
  displayName: string;
  followerCount?: number;
  products: Product[];
};

export default function HomePage() {
  const auth = useAuth();
  const products = useRequest(() => productsApi.list({ limit: 20 }), []);

  const sellerGroups = useMemo<SellerGroup[]>(() => {
    const grouped = new Map<string, SellerGroup>();

    for (const product of products.data?.data ?? []) {
      const current = grouped.get(product.seller.id);
      if (current) {
        current.products.push(product);
      } else {
        grouped.set(product.seller.id, {
          id: product.seller.id,
          userId: product.seller.userId,
          displayName: product.seller.displayName,
          followerCount: product.seller.followerCount,
          products: [product],
        });
      }
    }

    return Array.from(grouped.values());
  }, [products.data]);

  const allProducts = products.data?.data ?? [];
  const popularProducts = allProducts.slice(0, 4);
  const gridProducts = allProducts.slice(0, 12);
  const activeSellers = sellerGroups.slice(0, 5);

  return (
    <main className="app-shell with-nav figma-home">
      <div className="figma-home-top-chrome">
        <header className="figma-home-header">
          <Link
            className="figma-home-avatar"
            href={auth.isAuthenticated ? "/profile" : "/login"}
            aria-label="Profile"
          >
            {auth.user?.name?.slice(0, 1).toUpperCase() ?? ""}
          </Link>

          <Link className="figma-home-logo" href="/" aria-label="EaziCart home">
            <img src="/eazicart-mark.svg" alt="EaziCart" />
          </Link>

          <Link
            className="figma-home-notifications"
            href="/notifications"
            aria-label="Notifications"
          >
            <Icon name="bell" size={21} />
          </Link>
        </header>

        <Link className="figma-home-search" href="/explore">
          <Icon name="search" size={16} />
          <span>Search products, stores or brands</span>
        </Link>

        <nav className="figma-home-tabs" aria-label="Discover EaziCart">
          <Link className="active" href="/">For You</Link>
          <Link href="/explore">Trending</Link>
          <Link href="/explore#categories">Categories</Link>
          <Link href="/explore">Brands</Link>
          <Link href="/explore#sellers">Sellers</Link>
        </nav>
      </div>

      {products.loading ? (
        <LoadingState label="Loading products…" />
      ) : products.error ? (
        <ErrorState
          message={products.error}
          retry={() => void products.reload()}
        />
      ) : allProducts.length ? (
        <div className="figma-home-content">
          <section className="figma-home-active-sellers" aria-labelledby="active-sellers-heading">
            <div className="figma-home-section-heading">
              <h2 id="active-sellers-heading">
                <Icon name="sparkle" size={15} />
                Active Sellers
              </h2>
              <Link href="/explore#sellers">View all <span aria-hidden="true">›</span></Link>
            </div>

            <div className="figma-home-stories" role="list">
              {activeSellers.map((seller) => (
                <Link
                  className="figma-home-story"
                  href={`/seller/${seller.id}`}
                  key={seller.id}
                  role="listitem"
                >
                  <span className="figma-home-story-ring">
                    <span className="figma-home-story-avatar">
                      {seller.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  </span>
                  <strong>{seller.displayName}</strong>
                  <small>
                    {typeof seller.followerCount === "number"
                      ? `${seller.followerCount.toLocaleString()} followers`
                      : `${seller.products.length} ${seller.products.length === 1 ? "product" : "products"}`}
                  </small>
                </Link>
              ))}
            </div>
          </section>

          <section className="figma-home-popular" aria-labelledby="popular-products-heading">
            <div className="figma-home-section-heading">
              <h2 id="popular-products-heading">Popular products</h2>
              <Link href="/explore">See all</Link>
            </div>

            <div className="figma-home-popular-feed">
              {popularProducts.map((product) => (
                <Link
                  className="figma-home-popular-card"
                  href={`/product/${product.id}`}
                  key={product.id}
                >
                  <span className="figma-home-popular-media">
                    {product.images[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.images[0].altText ?? product.name}
                      />
                    ) : (
                      <span className="figma-home-media-placeholder" aria-hidden="true">
                        <Icon name="bag" size={24} />
                      </span>
                    )}
                  </span>
                  <strong>{product.name}</strong>
                  <b>{money(product.price)}</b>
                  <small>{product.stock > 0 ? "In stock" : "Out of stock"}</small>
                </Link>
              ))}
            </div>
          </section>

          <section className="figma-home-product-grid" aria-label="Recommended products">
            {gridProducts.map((product) => (
              <article className="figma-home-product" key={product.id}>
                <Link
                  className="figma-home-product-media"
                  href={`/product/${product.id}`}
                  aria-label={`View ${product.name}`}
                >
                  {product.images[0] ? (
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].altText ?? product.name}
                    />
                  ) : (
                    <span className="figma-home-media-placeholder" aria-hidden="true">
                      <Icon name="bag" size={30} />
                    </span>
                  )}
                  <span className="figma-home-heart" aria-hidden="true">
                    <Icon name="heart" size={19} />
                  </span>
                </Link>

                <div className="figma-home-product-copy">
                  <Link
                    className="figma-home-product-seller"
                    href={`/seller/${product.seller.id}`}
                  >
                    {product.seller.displayName}
                    <span aria-hidden="true">●</span>
                  </Link>
                  <Link className="figma-home-product-name" href={`/product/${product.id}`}>
                    {product.name}
                  </Link>
                  <strong>{money(product.price)}</strong>
                </div>
              </article>
            ))}
          </section>
        </div>
      ) : (
        <EmptyState message="No products are available yet." />
      )}

      <BottomNavigation />
    </main>
  );
}
