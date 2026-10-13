/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import "./home.css";
import "./home-social-feed.css";
import "./home-media.css";
import { BottomNavigation } from "./components/bottom-navigation";
import { SideNavigation } from "./components/side-navigation";
import { EmptyState, ErrorState, LoadingState } from "./components/async-state";
import { ProfileAvatar } from "./components/profile-avatar";
import { money } from "./data";
import { useRequest } from "./hooks/use-request";
import { useAuth } from "./providers/auth-provider";
import { cartApi } from "../lib/api/cart";
import { productsApi } from "../lib/api/products";
import { notificationsApi } from "../lib/api/notifications";
import { savedApi } from "../lib/api/saved";
import type { Product } from "../lib/api/types";
import {
  fetchStories,
  uploadSocialMedia,
  type SocialMediaItem,
} from "../lib/social-media";
import { homeDesignProducts } from "./home-design";
import { HomeSocialFeed } from "./home-social-feed";
import { Icon } from "./components/icon";
import type { ProductList } from "../lib/public-catalog";

function StoryPreview({ story }: { story: SocialMediaItem }) {
  if (story.contentType?.startsWith("video/")) {
    return (
      <video
        className="figma-home-story-preview"
        src={story.url}
        muted
        autoPlay
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        onCanPlay={(event) => {
          void event.currentTarget.play().catch(() => undefined);
        }}
      />
    );
  }

  return (
    <img
      className="figma-home-story-preview"
      src={story.url}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

export default function HomePage({
  initialProducts,
}: {
  initialProducts?: ProductList;
}) {
  const auth = useAuth();
  const router = useRouter();
  const products = useRequest(
    () => productsApi.list({ limit: 100 }),
    [],
    initialProducts,
  );
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
  const [stories, setStories] = useState<Record<string, SocialMediaItem>>({});
  const [storyBusy, setStoryBusy] = useState(false);
  const [storyError, setStoryError] = useState("");
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const items = products.data?.data ?? [];
  const sorted = [...items];
  const activeSellers = Array.from(
    new Map(
      sorted.map((product) => [product.seller.id, product.seller]),
    ).values(),
  ).slice(0, 8);
  const storyUserIds = Array.from(
    new Set([
      ...(auth.user ? [auth.user.id] : []),
      ...activeSellers
        .map((seller) => seller.userId)
        .filter((id): id is string => Boolean(id)),
    ]),
  );
  const storyKey = storyUserIds.join(",");

  useEffect(() => {
    let active = true;
    const ids = storyKey ? storyKey.split(",") : [];
    if (!ids.length) {
      setStories({});
      return () => {
        active = false;
      };
    }
    void fetchStories(ids).then((next) => {
      if (active) setStories(next);
    });
    return () => {
      active = false;
    };
  }, [storyKey]);

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

  const uploadStory = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!auth.user) {
      router.push("/login?next=/");
      return;
    }

    setStoryBusy(true);
    setStoryError("");
    try {
      const story = await uploadSocialMedia("story", auth.user.id, file);
      setStories((current) => ({ ...current, [auth.user!.id]: story }));
    } catch (error) {
      setStoryError(
        error instanceof Error ? error.message : "Could not upload your story",
      );
    } finally {
      setStoryBusy(false);
    }
  };

  return (
    <main
      className="app-shell with-nav figma-home social-home"
      data-figma-node="1247:16174"
    >
      <header className="figma-home-sticky social-home-sticky">
        <div className="figma-home-header">
          <button
            className="figma-home-avatar"
            aria-label="Open side navigation"
            onClick={() => setDrawer(true)}
          >
            {auth.user ? (
              <ProfileAvatar userId={auth.user.id} name={auth.user.name} />
            ) : (
              <Icon name="user-circle" size={32} />
            )}
          </button>
          <Link className="figma-home-logo" href="/" aria-label="EaziCart home">
            <img src="/figma/logo.svg" width={27} height={27} alt="" />
          </Link>
          <Link
            className="figma-home-bell"
            href="/notifications"
            aria-label="Notifications"
          >
            <Icon name="bell" size={24} />
            {notifications.data?.meta?.unreadCount ? (
              <b className="figma-home-notification-count">
                {notifications.data.meta.unreadCount}
              </b>
            ) : null}
          </Link>
        </div>
        <Link className="figma-home-search" href="/search">
          <Icon name="search" size={20} />
          <span>Search products, stores or brands</span>
        </Link>
        <nav className="figma-home-tabs" aria-label="Product discovery">
          <Link className="active" href="/" aria-current="page">
            For You
          </Link>
          <Link href="/explore?section=trending">Trending</Link>
          <Link href="/explore">Nearby</Link>
          <Link href="/following">Following</Link>
        </nav>
      </header>

      {auth.user || activeSellers.length ? (
        <section
          className="figma-home-stories social-home-stories"
          aria-label="Stories"
        >
          <div className="figma-home-section-header">
            <h2>Stories</h2>
            <Link href="/explore?section=sellers">View all</Link>
          </div>
          <div className="figma-home-story-strip">
            {auth.user ? (
              <label className="figma-home-story figma-home-story-add">
                <span
                  className={`figma-home-story-avatar ${stories[auth.user.id] ? "has-story" : ""}`}
                >
                  <span className="figma-home-story-media" aria-hidden="true">
                    {stories[auth.user.id] ? (
                      <StoryPreview story={stories[auth.user.id]!} />
                    ) : (
                      <ProfileAvatar
                        userId={auth.user.id}
                        name={auth.user.name}
                      />
                    )}
                  </span>
                  <b className="figma-home-story-plus">+</b>
                </span>
                <strong>{storyBusy ? "Uploading…" : "Your story"}</strong>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                  onChange={(event) => void uploadStory(event)}
                  disabled={storyBusy}
                  aria-label="Upload a story from your gallery"
                />
              </label>
            ) : null}
            {activeSellers.map((seller) => {
              const userId = seller.userId;
              const story = userId ? stories[userId] : undefined;
              return (
                <Link
                  className="figma-home-story"
                  href={
                    story && userId
                      ? `/story/${userId}`
                      : `/seller/${seller.id}`
                  }
                  key={seller.id}
                >
                  <span
                    className={`figma-home-story-avatar ${story ? "has-story" : ""}`}
                    aria-hidden="true"
                  >
                    <span className="figma-home-story-media">
                      {story ? (
                        <StoryPreview story={story} />
                      ) : userId ? (
                        <ProfileAvatar
                          userId={userId}
                          name={seller.displayName}
                        />
                      ) : (
                        seller.displayName.slice(0, 2).toUpperCase()
                      )}
                    </span>
                  </span>
                  <strong>{seller.displayName}</strong>
                </Link>
              );
            })}
          </div>
          {storyError ? (
            <p className="figma-home-story-upload-error" role="alert">
              {storyError}
            </p>
          ) : null}
        </section>
      ) : null}

      {products.loading && !products.data ? (
        <div className="social-home-state">
          <LoadingState label="Loading your feed…" />
        </div>
      ) : products.error && !products.data ? (
        <div className="social-home-state">
          <ErrorState
            message={products.error}
            retry={() => void products.reload()}
          />
        </div>
      ) : sorted.length ? (
        <HomeSocialFeed
          products={sorted}
          isSaved={isSaved}
          busy={busy}
          onToggleSaved={(product) => void toggleSaved(product)}
        />
      ) : (
        <div className="social-home-state">
          <EmptyState message="No products are available yet." />
        </div>
      )}

      {sorted.length ? (
        <section className="figma-home-for-you social-home-more-products">
          <SectionHeader title="More for you" />
          <div className="figma-home-product-grid">
            {sorted.slice(0, 16).map((product) => {
              const design = homeDesignProducts.find(
                (d) =>
                  d.name === product.name &&
                  d.seller === product.seller.displayName,
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
                      {product.images[0] ? (
                        <img
                          src={product.images[0].url}
                          alt={product.images[0].altText ?? product.name}
                        />
                      ) : design ? (
                        <img
                          src={`/figma/${design.image}`}
                          alt={product.name}
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
                      <Icon
                        name="heart"
                        size={20}
                        filled={isSaved(product.id)}
                      />
                    </span>
                  </button>
                  <div className="figma-home-product-copy">
                    <Link
                      className="figma-home-product-seller"
                      href={`/seller/${product.seller.id}`}
                    >
                      {product.seller.displayName}
                    </Link>
                    <Link
                      className="figma-home-product-title"
                      href={`/product/${product.id}`}
                    >
                      {product.name}
                    </Link>
                    <strong>{money(product.price)}</strong>
                    <div className="figma-home-product-rating">
                      <span>
                        {product.soldLabel ??
                          product.viewsLabel ??
                          (product.stock > 0
                            ? `${product.stock} in stock`
                            : "Out of stock")}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

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
