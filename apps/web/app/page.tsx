/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import "./home.css";
import { BottomNavigation } from "./components/bottom-navigation";
import { EmptyState, ErrorState } from "./components/async-state";
import { Icon } from "./components/icon";
import { money } from "./data";
import { useRequest } from "./hooks/use-request";
import { useAuth } from "./providers/auth-provider";
import { cartApi } from "../lib/api/cart";
import { categoriesApi } from "../lib/api/categories";
import { followsApi } from "../lib/api/follows";
import { productsApi } from "../lib/api/products";
import { savedApi } from "../lib/api/saved";
import type { Product } from "../lib/api/types";

type SellerGroup = {
  id: string;
  userId: string;
  displayName: string;
  bio?: string | null;
  products: Product[];
};

type ActionFeedback = {
  tone: "error" | "success";
  message: string;
};

function HomeSkeleton() {
  return (
    <section className="figma-home-skeleton" aria-label="Loading products">
      {Array.from({ length: 2 }).map((_, sellerIndex) => (
        <div className="figma-home-skeleton-group" key={sellerIndex}>
          <div className="figma-home-skeleton-seller">
            <span className="figma-home-skeleton-avatar" />
            <span className="figma-home-skeleton-copy">
              <i />
              <i />
            </span>
            <span className="figma-home-skeleton-follow" />
          </div>
          <div className="figma-home-skeleton-grid">
            {Array.from({ length: 2 }).map((__, productIndex) => (
              <div className="figma-home-skeleton-card" key={productIndex}>
                <span className="figma-home-skeleton-media" />
                <span className="figma-home-skeleton-line wide" />
                <span className="figma-home-skeleton-line short" />
                <span className="figma-home-skeleton-button" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function stockLabel(stock: number) {
  if (stock < 1) return "Out of stock";
  if (stock <= 5) return `Only ${stock} left`;
  return "In stock";
}

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
  const saved = useRequest(
    () =>
      auth.isAuthenticated ? savedApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const [busyCart, setBusyCart] = useState<string | null>(null);
  const [busyFollow, setBusyFollow] = useState<string | null>(null);
  const [busySaved, setBusySaved] = useState<string | null>(null);
  const [localFollowing, setLocalFollowing] = useState<Record<string, boolean>>(
    {},
  );
  const [localSaved, setLocalSaved] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

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
  const savedProductIds = useMemo(
    () => new Set((saved.data?.data ?? []).map((item) => item.productId)),
    [saved.data],
  );

  const isFollowing = (sellerUserId: string) =>
    localFollowing[sellerUserId] ?? followedSellerIds.has(sellerUserId);

  const isSaved = (productId: string) =>
    localSaved[productId] ?? savedProductIds.has(productId);

  const requireSignIn = () => {
    router.push(`/login?next=${encodeURIComponent("/")}`);
  };

  const addToCart = async (product: Product) => {
    if (!auth.isAuthenticated) {
      requireSignIn();
      return;
    }
    setBusyCart(product.id);
    setFeedback(null);
    try {
      await cartApi.add(product.id, 1);
      setFeedback({
        tone: "success",
        message: `${product.name} was added to your cart.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to add item to cart",
      });
    } finally {
      setBusyCart(null);
    }
  };

  const toggleFollow = async (sellerUserId: string) => {
    if (!auth.isAuthenticated) {
      requireSignIn();
      return;
    }
    const previous = isFollowing(sellerUserId);
    const next = !previous;
    setBusyFollow(sellerUserId);
    setFeedback(null);
    setLocalFollowing((current) => ({
      ...current,
      [sellerUserId]: next,
    }));
    try {
      if (next) await followsApi.follow(sellerUserId);
      else await followsApi.unfollow(sellerUserId);
    } catch (error) {
      setLocalFollowing((current) => ({
        ...current,
        [sellerUserId]: previous,
      }));
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update follow status",
      });
    } finally {
      setBusyFollow(null);
    }
  };

  const toggleSaved = async (product: Product) => {
    if (!auth.isAuthenticated) {
      requireSignIn();
      return;
    }
    const previous = isSaved(product.id);
    const next = !previous;
    setBusySaved(product.id);
    setFeedback(null);
    setLocalSaved((current) => ({ ...current, [product.id]: next }));
    try {
      if (next) await savedApi.save(product.id);
      else await savedApi.remove(product.id);
    } catch (error) {
      setLocalSaved((current) => ({ ...current, [product.id]: previous }));
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update saved products",
      });
    } finally {
      setBusySaved(null);
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
          {auth.user?.name?.slice(0, 1).toUpperCase() ?? "E"}
        </Link>
        <Link className="figma-home-logo" href="/" aria-label="EaziCart home">
          EaziCart
        </Link>
        <div className="figma-home-actions">
          <Link
            className="figma-home-icon"
            href="/notifications"
            aria-label="Notifications"
          >
            <Icon name="bell" size={21} />
          </Link>
          <Link
            className="figma-home-icon"
            href="/saved"
            aria-label="Saved products"
          >
            <Icon name="heart" size={21} />
          </Link>
          <Link className="figma-home-icon" href="/cart" aria-label="Cart">
            <Icon name="bag" size={21} />
          </Link>
        </div>
      </header>

      <form className="figma-home-search" action="/search">
        <Icon name="search" size={18} />
        <input
          name="search"
          aria-label="Search products and sellers"
          placeholder="Search products and sellers"
        />
        <button type="submit" aria-label="Search">
          <Icon name="chevron" size={18} />
        </button>
      </form>

      <nav className="figma-home-categories" aria-label="Product discovery">
        <Link className="active" href="/" aria-current="page">
          For You
        </Link>
        {categories.loading ? (
          <>
            <span className="figma-home-category-skeleton" />
            <span className="figma-home-category-skeleton" />
            <span className="figma-home-category-skeleton" />
          </>
        ) : (
          categories.data?.data.map((category) => (
            <Link
              href={`/category/${encodeURIComponent(category.slug)}`}
              key={category.id}
            >
              {category.name}
            </Link>
          ))
        )}
      </nav>

      {feedback ? (
        <p
          className={`figma-home-feedback ${feedback.tone}`}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="figma-home-feed-heading">
        <div>
          <h1>For you</h1>
          <p>Fresh products from sellers across EaziCart.</p>
        </div>
        <Link href="/explore">Explore</Link>
      </div>

      {products.loading ? (
        <HomeSkeleton />
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
                  aria-label={`View ${seller.displayName}`}
                >
                  {seller.displayName.slice(0, 1).toUpperCase()}
                </Link>
                <Link
                  className="figma-home-seller-copy"
                  href={`/seller/${seller.id}`}
                >
                  <strong>{seller.displayName}</strong>
                  <span>
                    {seller.bio || "Browse this seller's latest products."}
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
                  aria-pressed={isFollowing(seller.userId)}
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
                {seller.products.slice(0, 2).map((product) => {
                  const savedProduct = isSaved(product.id);
                  return (
                    <article className="figma-home-product" key={product.id}>
                      <div className="figma-home-product-media-wrap">
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
                            <span className="figma-home-product-placeholder">
                              <Icon name="bag" size={30} />
                            </span>
                          )}
                        </Link>
                        <button
                          className={`figma-home-save ${savedProduct ? "saved" : ""}`}
                          type="button"
                          disabled={busySaved === product.id}
                          aria-label={
                            savedProduct
                              ? `Remove ${product.name} from saved products`
                              : `Save ${product.name}`
                          }
                          aria-pressed={savedProduct}
                          onClick={() => void toggleSaved(product)}
                        >
                          <Icon name="heart" size={18} />
                        </button>
                      </div>

                      <div className="figma-home-product-copy">
                        <Link
                          className="figma-home-product-name"
                          href={`/product/${product.id}`}
                        >
                          {product.name}
                        </Link>
                        <div className="figma-home-product-meta">
                          <strong>{money(product.price)}</strong>
                          <span
                            className={
                              product.stock < 1
                                ? "out"
                                : product.stock <= 5
                                  ? "low"
                                  : ""
                            }
                          >
                            {stockLabel(product.stock)}
                          </span>
                        </div>
                        <button
                          className="figma-home-add"
                          type="button"
                          disabled={product.stock < 1 || busyCart === product.id}
                          onClick={() => void addToCart(product)}
                        >
                          {product.stock < 1 ? (
                            "Sold out"
                          ) : busyCart === product.id ? (
                            "Adding…"
                          ) : (
                            <>
                              <Icon name="plus" size={16} />
                              Add to cart
                            </>
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </section>
      ) : (
        <EmptyState
          title="No products yet"
          message="Products from EaziCart sellers will appear here as they are published."
          icon="bag"
          action={{ href: "/explore", label: "Explore EaziCart" }}
        />
      )}

      <BottomNavigation />
    </main>
  );
}
