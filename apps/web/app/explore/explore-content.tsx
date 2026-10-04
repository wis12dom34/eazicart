/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import "./explore.css";
import { BottomNavigation } from "../components/bottom-navigation";
import { SideNavigation } from "../components/side-navigation";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/async-state";
import { money } from "../data";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import { productsApi } from "../../lib/api/products";
import { sellersApi } from "../../lib/api/sellers";
import { notificationsApi } from "../../lib/api/notifications";
import { savedApi } from "../../lib/api/saved";

const cards = [
  {
    name: "AirPods Pro",
    seller: "Jumia Nigeria",
    label: "AirPods Pro",
    image: "airpods-pro-2.jpg",
  },
  {
    name: "Nike Air Max 90",
    seller: "Nike Official",
    label: "Nike Air Max",
    image: "nike-air-max-90.jpg",
  },
];
const reels = [
  {
    name: "Nike Air Max 90",
    seller: "Nike Official",
    label: "New arrivals",
    image: "nike-air-max-90.jpg",
    views: "12.4K",
  },
  {
    name: "iPhone 15 Pro",
    seller: "Jumia Nigeria",
    label: "Top picks",
    image: "iphone-15-pro.jpg",
    views: "9.8K",
  },
  {
    name: "Adidas Samba OG",
    seller: "Adidas Official",
    label: "For your day",
    image: "adidas-samba-og.jpg",
    views: "7.3K",
  },
];
export function ExploreContent() {
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const search = params.get("search") ?? "";
  const category = params.get("category") ?? "";
  const products = useRequest(
    () => productsApi.list({ search, category, limit: 100 }),
    [search, category],
  );
  const sellers = useRequest(() => sellersApi.list(), []);
  const notifications = useRequest(
    () =>
      auth.isAuthenticated
        ? notificationsApi.list()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const saved = useRequest(
    () =>
      auth.isAuthenticated ? savedApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const toggle = async (id: string, selected: boolean) => {
    if (!auth.isAuthenticated) {
      router.push("/login?next=%2Fexplore");
      return;
    }
    setBusy(id);
    setError("");
    try {
      if (selected) await savedApi.remove(id);
      else await savedApi.save(id);
      setOverrides((value) => ({ ...value, [id]: !selected }));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save product",
      );
    } finally {
      setBusy(null);
    }
  };
  const available = cards.map((card) => ({
    card,
    product: products.data?.data.find(
      (p) => p.name === card.name && p.seller.displayName === card.seller,
    ),
  }));
  return (
    <main className="app-shell figma-explore" data-figma-node="8:2">
      <div className="figma-explore-viewport">
        <header className="figma-explore-header">
          <button
            className="figma-explore-avatar"
            aria-label="Open side navigation"
            onClick={() => setMenu(true)}
          >
            <img
              src="/figma/explore-profile.svg"
              width={40}
              height={40}
              alt=""
            />
          </button>
          <Link
            className="figma-explore-logo"
            href="/"
            aria-label="EaziCart home"
          >
            <img src="/figma/explore-logo.svg" width={32} height={32} alt="" />
          </Link>
          <Link
            className="figma-explore-notifications"
            href="/notifications"
            aria-label="Notifications"
          >
            <img src="/figma/explore-bell.svg" width={22} height={22} alt="" />
            {notifications.data?.meta.unreadCount ? (
              <b>{notifications.data.meta.unreadCount}</b>
            ) : null}
          </Link>
        </header>
        <h1 className="figma-explore-title">Explore</h1>
        <div className="figma-explore-sticky">
          <form className="figma-explore-search" action="/search">
            <img
              src="/figma/explore-search.svg"
              width={20}
              height={20}
              alt=""
            />
            <input
              name="search"
              defaultValue={search}
              aria-label="Search products, stores or brands"
              placeholder="Search products, stores or brands"
            />
          </form>
          <nav className="figma-explore-tabs" aria-label="Explore sections">
            <span aria-current="page">For You</span>
            {["Trending", "Categories", "Brands", "Sellers"].map((label) => (
              <span
                key={label}
                aria-disabled="true"
                title={`${label} destination is not connected`}
              >
                {label}
              </span>
            ))}
          </nav>
        </div>
        <section className="figma-explore-trends">
          <h2>Trending Now</h2>
          <div>
            {["iPhone 17", "Sneakers", "Home Deals", "Beauty"].map((label) => (
              <Link
                key={label}
                href={`/search?search=${encodeURIComponent(label)}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </section>
        <section className="figma-explore-products">
          <h2>Popular Products</h2>
          {products.loading ? (
            <LoadingState label="Loading products…" />
          ) : products.error ? (
            <ErrorState
              message={products.error}
              retry={() => void products.reload()}
            />
          ) : available.some((p) => p.product) ? (
            <div className="figma-explore-grid">
              {available.map(({ card, product }) => {
                if (!product)
                  return (
                    <div
                      className="figma-explore-missing"
                      key={card.name}
                      aria-label={`${card.label} is unavailable`}
                    />
                  );
                const selected =
                  overrides[product.id] ??
                  saved.data?.data.some((p) => p.productId === product.id) ??
                  false;
                return (
                  <article className="figma-explore-product" key={product.id}>
                    <Link
                      className="figma-explore-product-media"
                      href={`/product/${product.id}`}
                      aria-label={`View ${product.name}`}
                    >
                      <img src={`/figma/${card.image}`} alt={product.name} />
                    </Link>
                    <Link
                      className="figma-explore-card-seller"
                      href={`/seller/${product.seller.id}`}
                    >
                      {product.seller.displayName}
                      <img
                        src="/figma/verified.svg"
                        width={16}
                        height={16}
                        alt="Verified seller"
                      />
                    </Link>
                    <Link
                      className="figma-explore-product-name"
                      href={`/product/${product.id}`}
                    >
                      {card.label}
                    </Link>
                    <strong>{money(product.price)}</strong>
                    <button
                      className="figma-explore-favourite"
                      aria-label={`${selected ? "Unsave" : "Save"} ${product.name}`}
                      aria-pressed={selected}
                      disabled={busy === product.id}
                      onClick={() => void toggle(product.id, selected)}
                    >
                      <img
                        src={
                          selected
                            ? "/figma/heart-saved.svg"
                            : "/figma/heart.svg"
                        }
                        width={18}
                        height={18}
                        alt=""
                      />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No products match your search." />
          )}
          {error ? <p role="alert">{error}</p> : null}
        </section>
        <section className="figma-explore-reels">
          <div>
            <h2>Reels</h2>
            <Link href="/reels">View all ›</Link>
          </div>
          <div className="figma-explore-reel-strip">
            {reels.map((reel) => {
              const product = products.data?.data.find(
                (p) =>
                  p.name === reel.name && p.seller.displayName === reel.seller,
              );
              return product ? (
                <Link
                  className="figma-explore-reel"
                  href={`/reels?productId=${encodeURIComponent(product.id)}`}
                  key={reel.name}
                >
                  <img src={`/figma/${reel.image}`} alt="" />
                  <i />
                  <strong>{reel.label}</strong>
                  <span>▶ {reel.views}</span>
                  <b />
                </Link>
              ) : null;
            })}
          </div>
        </section>
        <section className="figma-explore-sellers">
          <div>
            <h2>Top Sellers</h2>
            <span>All sellers</span>
          </div>
          <div className="figma-explore-seller-strip">
            {["Nike Official", "Jumia Nigeria", "HomeStyle NG"].map((name) => {
              const seller =
                sellers.data?.data.find((s) => s.displayName === name) ??
                products.data?.data.find((p) => p.seller.displayName === name)
                  ?.seller;
              return seller ? (
                <Link href={`/seller/${seller.id}`} key={name}>
                  <i />
                  <strong>
                    {name}
                    <img
                      src="/figma/verified.svg"
                      width={14}
                      height={14}
                      alt="Verified seller"
                    />
                  </strong>
                </Link>
              ) : (
                <div key={name}>
                  <i />
                  <strong>{name}</strong>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <button
        className="figma-explore-map"
        disabled
        title="Live map service is not connected"
      >
        <i />
        Map
      </button>
      <BottomNavigation />
      {menu ? <SideNavigation onClose={closeMenu} /> : null}
    </main>
  );
}
