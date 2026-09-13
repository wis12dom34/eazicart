/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import "./home.css";
import { BottomNavigation } from "./components/bottom-navigation";
import { EmptyState, ErrorState, LoadingState } from "./components/async-state";
import { Icon } from "./components/icon";
import { money } from "./data";
import { useRequest } from "./hooks/use-request";
import { useAuth } from "./providers/auth-provider";
import { cartApi } from "../lib/api/cart";
import { categoriesApi } from "../lib/api/categories";
import { followsApi } from "../lib/api/follows";
import { productsApi } from "../lib/api/products";
import type { Product } from "../lib/api/types";

const categoryIcons: Record<string, string> = {
  phones: "phone",
  fashion: "shirt",
  home: "home",
  "home-living": "home",
  beauty: "sparkle",
  groceries: "bag",
};

type SellerGroup = {
  id: string;
  userId: string;
  displayName: string;
  bio?: string | null;
  products: Product[];
};

export default function HomePage() {
  const auth = useAuth();
  const router = useRouter();
  const categories = useRequest(() => categoriesApi.list(), []);
  const products = useRequest(() => productsApi.list({ limit: 12 }), []);
  const following = useRequest(
    () =>
      auth.isAuthenticated ? followsApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const [busyCart, setBusyCart] = useState<string | null>(null);
  const [busyFollow, setBusyFollow] = useState<string | null>(null);
  const [localFollowing, setLocalFollowing] = useState<Record<string, boolean>>(
    {},
  );

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
          bio: product.seller.bio,
          products: [product],
        });
      }
    }
    return Array.from(grouped.values());
  }, [products.data]);

  const followedSellerIds = useMemo(
    () => new Set((following.data?.data ?? []).map((item) => item.sellerId)),
    [following.data],
  );

  const isFollowing = (sellerUserId: string) =>
    localFollowing[sellerUserId] ?? followedSellerIds.has(sellerUserId);

  const addToCart = async (product: Product) => {
    if (!auth.isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent("/")}`);
      return;
    }
    setBusyCart(product.id);
    try {
      await cartApi.add(product.id, 1);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to add item to cart",
      );
    } finally {
      setBusyCart(null);
    }
  };

  const toggleFollow = async (sellerUserId: string) => {
    if (!auth.isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent("/")}`);
      return;
    }
    const next = !isFollowing(sellerUserId);
    setBusyFollow(sellerUserId);
    try {
      if (next) await followsApi.follow(sellerUserId);
      else await followsApi.unfollow(sellerUserId);
      setLocalFollowing((current) => ({
        ...current,
        [sellerUserId]: next,
      }));
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to update follow status",
      );
    } finally {
      setBusyFollow(null);
    }
  };

  return (
    <main className="app-shell with-nav figma-home">
      <header className="figma-home-header">
        <Link
          className="figma-home-avatar"
          href={auth.isAuthenticated ? "/profile" : "/login"}
          aria-label="Profile"
        >
          {auth.user?.name?.slice(0, 1).toUpperCase() ?? ""}
        </Link>
        <Link className="figma-home-logo" href="/" aria-label="EaziCart home">
          <span aria-hidden="true">↗</span>
        </Link>
        <div className="figma-home-actions">
          <Link
            className="figma-home-icon"
            href="/notifications"
            aria-label="Notifications"
          >
            <Icon name="bell" size={20} />
          </Link>
          <Link className="figma-home-icon" href="/cart" aria-label="Cart">
            <Icon name="bag" size={20} />
          </Link>
        </div>
      </header>

      <Link className="figma-home-search" href="/explore">
        <Icon name="search" size={15} />
        <span>Search products, brands and more...</span>
      </Link>

      <nav className="figma-home-categories" aria-label="Product categories">
        <Link className="active" href="/">
          <span className="figma-home-category-icon" aria-hidden="true" />
          <small>For You</small>
        </Link>
        {categories.data?.data.map((category) => (
          <Link
            href={`/category/${encodeURIComponent(category.slug)}`}
            key={category.id}
          >
            <span className="figma-home-category-icon" aria-hidden="true">
              <Icon name={categoryIcons[category.slug] ?? "bag"} size={18} />
            </span>
            <small>{category.name}</small>
          </Link>
        ))}
      </nav>

      {products.loading ? (
        <LoadingState label="Loading products…" />
      ) : products.error ? (
        <ErrorState
          message={products.error}
          retry={() => void products.reload()}
        />
      ) : sellerGroups.length ? (
        <section className="figma-home-feed" aria-label="For you product feed">
          {sellerGroups.map((seller) => (
            <section className="figma-home-seller" key={seller.id}>
              <div className="figma-home-seller-row">
                <Link
                  className="figma-home-seller-avatar"
                  href={`/seller/${seller.id}`}
                  aria-hidden="true"
                >
                  {seller.displayName.slice(0, 1).toUpperCase()}
                </Link>
                <Link
                  className="figma-home-seller-copy"
                  href={`/seller/${seller.id}`}
                >
                  <strong>{seller.displayName}</strong>
                  <span>
                    {seller.bio || "Shop this seller's latest products."}
                  </span>
                </Link>
                <button
                  className={
                    isFollowing(seller.userId)
                      ? "figma-home-follow following"
                      : "figma-home-follow"
                  }
                  type="button"
                  disabled={busyFollow === seller.userId}
                  onClick={() => void toggleFollow(seller.userId)}
                >
                  {busyFollow === seller.userId
                    ? "…"
                    : isFollowing(seller.userId)
                      ? "Following"
                      : "Follow"}
                </button>
              </div>

              <div className="figma-home-product-grid">
                {seller.products.slice(0, 2).map((product) => (
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
                      ) : null}
                    </Link>
                    <div className="figma-home-product-copy">
                      <Link href={`/product/${product.id}`}>
                        {product.name}
                      </Link>
                      <strong>{money(product.price)}</strong>
                      <button
                        type="button"
                        disabled={product.stock < 1 || busyCart === product.id}
                        onClick={() => void addToCart(product)}
                      >
                        {product.stock < 1
                          ? "Out of stock"
                          : busyCart === product.id
                            ? "Adding…"
                            : "Add to Cart"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      ) : (
        <EmptyState message="No products are available yet." />
      )}

      <BottomNavigation />
    </main>
  );
}
