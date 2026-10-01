/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import "./home.css";
import { BottomNavigation } from "./components/bottom-navigation";
import { SideNavigation } from "./components/side-navigation";
import { EmptyState, ErrorState, LoadingState } from "./components/async-state";
import { money } from "./data";
import { useRequest } from "./hooks/use-request";
import { useAuth } from "./providers/auth-provider";
import { cartApi } from "../lib/api/cart";
import { productsApi } from "../lib/api/products";
import { notificationsApi } from "../lib/api/notifications";
import { savedApi } from "../lib/api/saved";
import type { Product } from "../lib/api/types";
import { HomeSections } from "./home-sections";
import { homeDesignProducts } from "./home-design";

const stories = [
  ["TechHub", "4.8", "1.2K"],
  ["Nike Official", "4.9", "3.4K"],
  ["Apple Store NG", "4.7", "980"],
  ["HomeStyle NG", "4.8", "540"],
  ["Glow Beauty", "4.8", "3.4K"],
];
const popular = [
  "iPhone 15 Pro",
  "AirPods Pro 2",
  "Nike Air Max 90",
  "Galaxy S25 Ultra",
];
export default function HomePage() {
  const auth = useAuth();
  const router = useRouter();
  const products = useRequest(() => productsApi.list({ limit: 100 }), []);
  const cart = useRequest(
    () => (auth.isAuthenticated ? cartApi.get() : Promise.resolve(undefined)),
    [auth.isAuthenticated],
  );
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
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [localSaved, setLocalSaved] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState("");
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const items = products.data?.data ?? [];
  const sorted = [...items].sort((a, b) => {
    const index = (product: Product) =>
      homeDesignProducts.findIndex(
        (d) =>
          (d.name === product.name &&
            d.seller === product.seller.displayName) ||
          (d.name === "Nike Club Hoodie" &&
            product.name === "Club Hoodie" &&
            product.seller.displayName === "Nike Official"),
      );
    return (index(a) < 0 ? 100 : index(a)) - (index(b) < 0 ? 100 : index(b));
  });
  const isSaved = (id: string) =>
    localSaved[id] ??
    saved.data?.data.some((item) => item.productId === id) ??
    false;
  const toggleSaved = async (product: Product) => {
    if (!auth.isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent("/")}`);
      return;
    }
    const next = !isSaved(product.id);
    setBusy(product.id);
    setFeedback("");
    try {
      if (next) await savedApi.save(product.id);
      else await savedApi.remove(product.id);
      setLocalSaved((previous) => ({ ...previous, [product.id]: next }));
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Could not update saved items",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <main
      className="app-shell with-nav figma-home"
      data-figma-node="1247:16174"
    >
      <header className="figma-home-sticky">
        <div className="figma-home-header">
          <div className="figma-home-island" aria-hidden="true" />
          <button
            className="figma-home-avatar"
            aria-label="Open side navigation"
            onClick={() => setDrawer(true)}
          >
            <img src="/figma/profile.svg" width={36} height={36} alt="" />
          </button>
          <Link className="figma-home-logo" href="/" aria-label="EaziCart home">
            <img src="/figma/logo.svg" width={27} height={27} alt="" />
          </Link>
          <Link
            className="figma-home-bell"
            href="/notifications"
            aria-label="Notifications"
          >
            <img src="/figma/bell.svg" width={24} height={24} alt="" />
            {notifications.data?.meta?.unreadCount ? (
              <b className="figma-home-notification-count">
                {notifications.data.meta.unreadCount}
              </b>
            ) : null}
          </Link>
        </div>
        <Link className="figma-home-search" href="/explore">
          <img src="/figma/search.svg" width={18} height={18} alt="" />
          <span>Search products, stores or brands</span>
        </Link>
        <nav className="figma-home-tabs" aria-label="Product discovery">
          <Link className="active" href="/">
            For You
          </Link>
          {["Trending", "Categories", "Brands", "Sellers"].map((label) => (
            <span
              role="link"
              aria-disabled="true"
              title={`${label} screen is not connected yet`}
              key={label}
            >
              {label}
            </span>
          ))}
        </nav>
      </header>
      <section className="figma-home-stories" aria-label="Active Sellers">
        <div className="figma-home-section-header">
          <h2>
            <img src="/figma/sparkle.svg" width={15} height={15} alt="" />
            Active Sellers
          </h2>
          <span>
            View all <b>›</b>
          </span>
        </div>
        <div className="figma-home-story-strip">
          {stories.map(([name, rating, sales], index) => (
            <div className="figma-home-story" key={name}>
              <img
                src={`/figma/story-${index}.svg`}
                alt=""
                width={66}
                height={66}
              />
              <strong>{name}</strong>
              <small>
                {rating} <b>★</b> · {sales} sales
              </small>
            </div>
          ))}
        </div>
      </section>
      <div className="figma-home-divider" />
      <section className="figma-home-popular">
        <SectionHeader title="Popular products" />
        <div className="figma-home-popular-strip">
          {popular.map((name) => {
            const design = homeDesignProducts.find((d) => d.name === name);
            const product = items.find(
              (p) => p.name === name && p.seller.displayName === design?.seller,
            );
            return product && design ? (
              <Link
                className="figma-home-popular-card"
                href={`/product/${product.id}`}
                key={name}
              >
                <div style={{ background: design.background }}>
                  <img src={`/figma/${design.image}`} alt={name} />
                </div>
                <strong>{name}</strong>
                <b>{money(product.price)}</b>
                <small>
                  {product.viewsLabel ? `${product.viewsLabel} views` : ""}
                </small>
              </Link>
            ) : null;
          })}
        </div>
      </section>
      <div className="figma-home-divider" />
      <section className="figma-home-for-you">
        <SectionHeader title="For you" />
        {products.loading ? (
          <LoadingState label="Loading products…" />
        ) : products.error ? (
          <ErrorState
            message={products.error}
            retry={() => void products.reload()}
          />
        ) : sorted.length ? (
          <div className="figma-home-product-grid">
            {sorted.slice(0, 16).map((product) => {
              const design = homeDesignProducts.find(
                (d) =>
                  (d.name === product.name &&
                    d.seller === product.seller.displayName) ||
                  (d.name === "Nike Club Hoodie" &&
                    product.name === "Club Hoodie" &&
                    product.seller.displayName === "Nike Official"),
              );
              return (
                <article className="figma-home-product" key={product.id}>
                  <Link
                    className="figma-home-product-media"
                    style={{ background: design?.background }}
                    href={`/product/${product.id}`}
                    aria-label={`View ${product.name}`}
                  >
                    <div>
                      {design ? (
                        <img
                          src={`/figma/${design.image}`}
                          alt={product.name}
                        />
                      ) : product.images[0] ? (
                        <img
                          src={product.images[0].url}
                          alt={product.images[0].altText ?? product.name}
                        />
                      ) : null}
                    </div>
                  </Link>
                  <button
                    className="figma-home-favourite"
                    type="button"
                    aria-label={`${isSaved(product.id) ? "Unsave" : "Save"} ${product.name}`}
                    aria-pressed={isSaved(product.id)}
                    disabled={busy === product.id}
                    onClick={() => void toggleSaved(product)}
                  >
                    <span>
                      <img
                        src={
                          isSaved(product.id)
                            ? "/figma/heart-saved.svg"
                            : "/figma/heart.svg"
                        }
                        alt=""
                        width={18}
                        height={18}
                      />
                    </span>
                  </button>
                  <div className="figma-home-product-copy">
                    <div className="figma-home-product-seller">
                      {product.seller.displayName}
                      {design?.seller === product.seller.displayName ? (
                        <b>✓</b>
                      ) : null}
                    </div>
                    <Link
                      className="figma-home-product-title"
                      href={`/product/${product.id}`}
                    >
                      {design?.name ?? product.name}
                    </Link>
                    <strong>{money(product.price)}</strong>
                    <div className="figma-home-product-rating">
                      {product.rating ? (
                        <>
                          <b>★</b>
                          {product.rating}
                        </>
                      ) : null}
                      {product.soldLabel ? (
                        <span>· {product.soldLabel} sold</span>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState message="No products are available yet." />
        )}
      </section>
      {sorted.length ? <HomeSections products={sorted} /> : null}
      {feedback ? (
        <p role="alert" className="figma-home-feedback">
          {feedback}
        </p>
      ) : null}
      <BottomNavigation
        cartCount={cart.data?.data.items.reduce(
          (n, item) => n + item.quantity,
          0,
        )}
      />
      {drawer ? <SideNavigation onClose={closeDrawer} /> : null}
    </main>
  );
}
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="figma-home-section-header">
      <h2>{title}</h2>
      <Link href="/explore">See all</Link>
    </div>
  );
}
