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
import { reelsApi } from "../../lib/api/reels";

export function ExploreContent() {
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const search = params.get("search") ?? "";
  const section = params.get("section") ?? "for-you";
  const products = useRequest(
    () => productsApi.list({ search, limit: 100 }),
    [search],
  );
  const sellers = useRequest(() => sellersApi.list(), []);
  const reels = useRequest(() => reelsApi.feed({ limit: 6 }), []);
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

  const productRows = products.data?.data ?? [];
  const categories = Array.from(
    new Map(
      productRows.map((product) => [product.category.id, product.category]),
    ).values(),
  );

  const toggle = async (id: string, selected: boolean) => {
    if (!auth.isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent("/explore")}`);
      return;
    }
    if (busy) return;
    setBusy(id);
    setError("");
    try {
      if (selected) await savedApi.remove(id);
      else await savedApi.save(id);
      setOverrides((value) => ({ ...value, [id]: !selected }));
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save product",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="app-shell with-nav figma-explore" data-figma-node="8:2">
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
              aria-label="Search products and sellers"
              placeholder="Search products and sellers"
            />
          </form>
          <nav className="figma-explore-tabs" aria-label="Explore sections">
            <Link
              href="/explore"
              aria-current={section === "for-you" ? "page" : undefined}
            >
              For You
            </Link>
            <Link
              href="/explore?section=categories"
              aria-current={section === "categories" ? "page" : undefined}
            >
              Categories
            </Link>
            <Link
              href="/explore?section=sellers"
              aria-current={section === "sellers" ? "page" : undefined}
            >
              Sellers
            </Link>
          </nav>
        </div>

        {section === "categories" ? (
          <section
            className="figma-explore-trends"
            aria-labelledby="explore-categories"
          >
            <h2 id="explore-categories">Categories</h2>
            {products.loading ? (
              <LoadingState label="Loading categories…" />
            ) : products.error ? (
              <ErrorState
                message={products.error}
                retry={() => void products.reload()}
              />
            ) : categories.length ? (
              <div>
                {categories.map((category) => (
                  <Link key={category.id} href={`/category/${category.slug}`}>
                    {category.name}
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState message="No categories are available yet." />
            )}
          </section>
        ) : null}

        {section === "for-you" ? (
          <>
            <section
              className="figma-explore-products"
              aria-labelledby="explore-products"
            >
              <h2 id="explore-products">Products</h2>
              {products.loading ? (
                <LoadingState label="Loading products…" />
              ) : products.error ? (
                <ErrorState
                  message={products.error}
                  retry={() => void products.reload()}
                />
              ) : productRows.length ? (
                <div className="figma-explore-grid">
                  {productRows.map((product) => {
                    const selected =
                      overrides[product.id] ??
                      saved.data?.data.some(
                        (entry) => entry.productId === product.id,
                      ) ??
                      false;
                    return (
                      <article
                        className="figma-explore-product"
                        key={product.id}
                      >
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
                          ) : (
                            <span aria-hidden="true">
                              {product.name.slice(0, 1)}
                            </span>
                          )}
                        </Link>
                        <Link
                          className="figma-explore-card-seller"
                          href={`/seller/${product.seller.id}`}
                        >
                          {product.seller.displayName}
                        </Link>
                        <Link
                          className="figma-explore-product-name"
                          href={`/product/${product.id}`}
                        >
                          {product.name}
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

            {reels.data?.data.length ? (
              <section
                className="figma-explore-reels"
                aria-labelledby="explore-reels"
              >
                <div>
                  <h2 id="explore-reels">Reels</h2>
                  <Link href="/reels">View all ›</Link>
                </div>
                <div className="figma-explore-reel-strip">
                  {reels.data.data.map((reel) => (
                    <Link
                      className="figma-explore-reel"
                      href={`/reels?reelId=${encodeURIComponent(reel.id)}`}
                      key={reel.id}
                    >
                      {reel.thumbnailUrl || reel.product?.images[0]?.url ? (
                        <img
                          src={
                            reel.thumbnailUrl ??
                            reel.product?.images[0]?.url ??
                            ""
                          }
                          alt=""
                        />
                      ) : (
                        <i />
                      )}
                      <strong>
                        {reel.caption || reel.product?.name || "Reel"}
                      </strong>
                      <span>▶ {reel._count.views}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {section === "sellers" || section === "for-you" ? (
          <section
            className="figma-explore-sellers"
            id="sellers"
            aria-labelledby="explore-sellers"
          >
            <div>
              <h2 id="explore-sellers">Sellers</h2>
            </div>
            {sellers.loading ? (
              <LoadingState label="Loading sellers…" />
            ) : sellers.error ? (
              <ErrorState
                message={sellers.error}
                retry={() => void sellers.reload()}
              />
            ) : sellers.data?.data.length ? (
              <div className="figma-explore-seller-strip">
                {sellers.data.data.map((seller) => (
                  <Link href={`/seller/${seller.id}`} key={seller.id}>
                    <i aria-hidden="true" />
                    <strong>{seller.displayName}</strong>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState message="No sellers are available yet." />
            )}
          </section>
        ) : null}
      </div>

      <Link
        className="figma-explore-map"
        href="/explore/map"
        title="Open live commerce map"
        aria-label="Open live commerce map"
      >
        <i aria-hidden="true" />
        Map
      </Link>
      <BottomNavigation />
      {menu ? <SideNavigation onClose={closeMenu} /> : null}
    </main>
  );
}
