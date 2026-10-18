/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import dynamic from "next/dynamic";
import { ContentImage } from "./components/content-image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import "./home.css";
import "./home-social-feed.css";
import "./home-media.css";
import { BottomNavigation } from "./components/bottom-navigation";
import { EmptyState, ErrorState, LoadingState } from "./components/async-state";
import { ProfileAvatar } from "./components/profile-avatar";
import { money } from "./data";
import { useRequest } from "./hooks/use-request";
import { useAuth } from "./providers/auth-provider";
import { productsApi } from "../lib/api/products";
import { savedApi } from "../lib/api/saved";
import { homeApi } from "../lib/api/home";
import type { Product } from "../lib/api/types";
import {
  fetchProfilePhotos,
  fetchStories,
  uploadSocialMedia,
  type SocialMediaItem,
} from "../lib/social-media";
import { homeDesignProducts } from "./home-design";
import { HomeSocialFeed } from "./home-social-feed";
import { Icon } from "./components/icon";
import {
  CustomerDesktopRail,
  DesktopCustomerShell,
} from "./components/desktop-customer-shell";

function HomeLink(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />;
}

// The drawer is never visible during first paint. Keep its orders/profile logic
// out of the Home startup bundle and load it only when the user opens the menu.
const SideNavigation = dynamic(
  () =>
    import("./components/side-navigation").then(
      (module) => module.SideNavigation,
    ),
  { ssr: false },
);
import type { ProductList } from "../lib/public-catalog";

function StoryPreview({
  story,
  userId,
  name,
}: {
  story?: SocialMediaItem;
  userId: string;
  name: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  if (!story || failedUrl === story.url)
    return <ProfileAvatar userId={userId} name={name} />;
  if (story.contentType?.startsWith("video/"))
    return (
      <video
        src={`${story.url}#t=0.1`}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (Number.isFinite(video.duration) && video.duration > 0)
            video.currentTime = Math.min(0.1, video.duration / 2);
        }}
        onError={() => setFailedUrl(story.url)}
      />
    );
  return (
    <ContentImage
      src={story.url}
      alt=""
      width={52}
      height={52}
      sizes="52px"
      onError={() => setFailedUrl(story.url)}
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
    // The server already put the public FYP in the first HTML. Keep that feed
    // stable while auth restores instead of replacing it during hydration.
    // Only authenticated sessions need the personalized refresh.
    () =>
      auth.loading && initialProducts
        ? Promise.resolve({
            data: initialProducts.data,
            pagination: initialProducts.pagination,
          })
        : initialProducts && !auth.isAuthenticated
          ? Promise.resolve({
              data: initialProducts.data,
              pagination: initialProducts.pagination,
            })
          : productsApi.feed(40, auth.isAuthenticated),
    [auth.loading, auth.isAuthenticated],
    initialProducts
      ? { data: initialProducts.data, pagination: initialProducts.pagination }
      : undefined,
  );
  const [homeState, setHomeState] = useState({
    cartCount: 0,
    unreadCount: 0,
    savedProductIds: [] as string[],
  });
  const [extraProducts, setExtraProducts] = useState<Product[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [feedPageError, setFeedPageError] = useState(false);
  const feedSentinel = useRef<HTMLDivElement>(null);
  const feedRequesting = useRef(false);
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [localSaved, setLocalSaved] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState("");
  const [stories, setStories] = useState<Record<string, SocialMediaItem>>({});
  const [storyBusy, setStoryBusy] = useState(false);
  const [storyError, setStoryError] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const items = products.data?.data ?? [];
  const sorted = [
    ...items,
    ...extraProducts.filter(
      (extra) => !items.some((item) => item.id === extra.id),
    ),
  ];
  const activeSellers = Array.from(
    new Map(
      sorted.map((product) => [product.seller.id, product.seller]),
    ).values(),
  ).slice(0, 8);
  const storyUserIds = Array.from(
    new Set([
      ...(auth.user ? [auth.user.id] : []),
      ...activeSellers
        .map((s) => s.userId)
        .filter((id): id is string => Boolean(id)),
    ]),
  );
  const storyKey = storyUserIds.join(",");

  useEffect(() => {
    setExtraProducts([]);
    setFeedCursor(null);
    setFeedHasMore(false);
    setFeedPageError(false);
    feedRequesting.current = false;
  }, [auth.isAuthenticated]);

  useEffect(() => {
    const firstPage = products.data;
    if (firstPage?.pagination) {
      setFeedCursor(firstPage.pagination.nextCursor);
      setFeedHasMore(firstPage.pagination.hasMore);
    }
  }, [products.data]);

  const loadMoreFeed = useCallback(async () => {
    if (
      feedRequesting.current ||
      !feedHasMore ||
      !feedCursor ||
      auth.loading ||
      products.loading
    )
      return;
    feedRequesting.current = true;
    setFeedLoadingMore(true);
    setFeedPageError(false);
    try {
      const result = await productsApi.feed(
        40,
        auth.isAuthenticated,
        feedCursor,
      );
      setExtraProducts((previous) => {
        const known = new Set(
          [...(products.data?.data ?? []), ...previous].map(
            (product) => product.id,
          ),
        );
        return [
          ...previous,
          ...result.data.filter((product) => !known.has(product.id)),
        ];
      });
      setFeedCursor(result.pagination.nextCursor);
      setFeedHasMore(result.pagination.hasMore);
    } catch {
      setFeedPageError(true);
    } finally {
      feedRequesting.current = false;
      setFeedLoadingMore(false);
    }
  }, [
    feedHasMore,
    feedCursor,
    auth.loading,
    auth.isAuthenticated,
    products.loading,
    products.data,
  ]);

  useEffect(() => {
    const node = feedSentinel.current;
    if (!node || !feedHasMore || !feedCursor) return;
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void loadMoreFeed();
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feedHasMore, feedCursor, loadMoreFeed]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) {
      setHomeState({ cartCount: 0, unreadCount: 0, savedProductIds: [] });
      return;
    }
    let active = true;
    const start = () => {
      void homeApi
        .state()
        .then((result) => {
          if (active) setHomeState(result.data);
        })
        .catch(() => undefined);
    };
    const win = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    // Badges and saved-heart state are secondary to the personalized feed. Let
    // Safari paint the first post before asking for this small account summary.
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(start, { timeout: 1000 });
      return () => {
        active = false;
        win.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(start, 500);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [auth.loading, auth.isAuthenticated]);

  useEffect(() => {
    const sellerIds = Array.from(
      new Set(
        (products.data?.data ?? [])
          .map((product) => product.seller.userId || product.seller.user?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    ).slice(0, 50);
    if (!sellerIds.length) return;
    let cancelled = false;
    const start = () => {
      if (!cancelled) void fetchProfilePhotos(sellerIds);
    };
    const win = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const isIOSWebKit = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!isIOSWebKit && win.requestIdleCallback) {
      const id = win.requestIdleCallback(start, { timeout: 1800 });
      return () => {
        cancelled = true;
        win.cancelIdleCallback?.(id);
      };
    }
    // Safari can call idle callbacks while image decoding is still busy. Text
    // initials are already visible, so keep seller-photo hydration out of the
    // critical startup window there as well.
    const id = window.setTimeout(start, isIOSWebKit ? 2800 : 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [products.data]);

  useEffect(() => {
    let active = true;
    const ids = storyKey ? storyKey.split(",") : [];
    if (!ids.length) {
      setStories({});
      return () => {
        active = false;
      };
    }
    const start = () => {
      void fetchStories(ids).then((next) => {
        if (active) setStories(next);
      });
    };
    const win = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    // Story media is secondary. Safari can report idle while it is still decoding
    // the first feed image, so do not let requestIdleCallback pull story media
    // into the critical startup window.
    const isIOSWebKit = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!isIOSWebKit && win.requestIdleCallback) {
      const id = win.requestIdleCallback(start, { timeout: 1800 });
      return () => {
        active = false;
        win.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(start, isIOSWebKit ? 2200 : 900);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [storyKey]);
  useEffect(() => {
    let frame = 0;
    let last = window.scrollY > 72;
    setCollapsed(last);
    const update = () => {
      frame = 0;
      const next = window.scrollY > 72;
      if (next !== last) {
        last = next;
        setCollapsed(next);
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const isSaved = (id: string) =>
    localSaved[id] ?? homeState.savedProductIds.includes(id) ?? false;
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
    <DesktopCustomerShell activeHref="/" rail={<CustomerDesktopRail />}>
      <main
        className={`app-shell with-nav figma-home social-home ${collapsed ? "home-header-collapsed" : ""}`}
        data-figma-node="3210:20007"
      >
        <header
          className="figma-home-sticky social-home-sticky"
          data-figma-node="3291:20474"
        >
          <div className="figma-home-header">
            <button
              className="figma-home-avatar"
              aria-label="Open side navigation"
              onClick={() => setDrawer(true)}
            >
              {auth.user ? (
                <ProfileAvatar userId={auth.user.id} name={auth.user.name} />
              ) : (
                <Icon name="user-circle" size={20} />
              )}
            </button>
            <HomeLink
              className="figma-home-logo"
              href="/"
              aria-label="EaziCart home"
            >
              <img src="/figma/logo.svg" width={32} height={32} alt="" />
            </HomeLink>
            <div className="figma-home-header-actions">
              {collapsed ? (
                <HomeLink
                  className="figma-home-compact-search"
                  href="/search"
                  aria-label="Search"
                >
                  <Icon name="search" size={20} />
                </HomeLink>
              ) : null}
              <HomeLink
                className="figma-home-bell"
                href="/notifications"
                aria-label="Notifications"
              >
                <Icon
                  name="bell"
                  size={22}
                  active={Boolean(homeState.unreadCount)}
                />
                {homeState.unreadCount ? (
                  <b className="figma-home-notification-count">
                    {homeState.unreadCount}
                  </b>
                ) : null}
              </HomeLink>
            </div>
          </div>
          <HomeLink className="figma-home-search" href="/search">
            <Icon name="search" size={20} />
            <span>Search products, stores or brands</span>
          </HomeLink>
          <nav className="figma-home-tabs" aria-label="Product discovery">
            <HomeLink className="active" href="/" aria-current="page">
              For You
            </HomeLink>
            <HomeLink href="/explore?section=trending">Trending</HomeLink>
            <HomeLink href="/explore?section=categories">Categories</HomeLink>
            <HomeLink href="/explore?section=nearby">Nearby</HomeLink>
            <HomeLink href="/following">Following</HomeLink>
          </nav>
        </header>
        {auth.user || activeSellers.length ? (
          <section
            className="figma-home-stories social-home-stories"
            aria-label="Stories"
            data-figma-node="3210:20038"
          >
            <div className="figma-home-story-strip">
              {auth.user ? (
                stories[auth.user.id] ? (
                  <HomeLink
                    className="figma-home-story figma-home-story-add"
                    href={`/story/${auth.user.id}`}
                  >
                    <span className="figma-home-story-avatar has-story">
                      <span
                        className="figma-home-story-media"
                        aria-hidden="true"
                      >
                        <StoryPreview
                          story={stories[auth.user.id]}
                          userId={auth.user.id}
                          name={auth.user.name}
                        />
                      </span>
                      <b className="figma-home-story-plus">
                        <Icon name="plus" size={12} weight="semibold" />
                      </b>
                    </span>
                    <strong>My story</strong>
                  </HomeLink>
                ) : (
                  <label className="figma-home-story figma-home-story-add">
                    <span className="figma-home-story-avatar">
                      <span
                        className="figma-home-story-media"
                        aria-hidden="true"
                      >
                        <StoryPreview
                          userId={auth.user.id}
                          name={auth.user.name}
                        />
                      </span>
                      <b className="figma-home-story-plus">
                        <Icon name="plus" size={12} weight="semibold" />
                      </b>
                    </span>
                    <strong>{storyBusy ? "Uploading…" : "My story"}</strong>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                      onChange={(event) => void uploadStory(event)}
                      disabled={storyBusy}
                      aria-label="Upload a story from your gallery"
                    />
                  </label>
                )
              ) : null}
              {activeSellers.map((seller) => {
                const userId = seller.userId;
                const story = userId ? stories[userId] : undefined;
                return (
                  <HomeLink
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
                        {userId ? (
                          <StoryPreview
                            story={story}
                            userId={userId}
                            name={seller.displayName}
                          />
                        ) : (
                          seller.displayName.slice(0, 2).toUpperCase()
                        )}
                      </span>
                    </span>
                    <strong>{seller.displayName}</strong>
                  </HomeLink>
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
        {feedHasMore || feedLoadingMore || feedPageError ? (
          <div ref={feedSentinel} aria-hidden="true" style={{ height: 1 }} />
        ) : null}
        {feedLoadingMore ? (
          <div className="social-home-state" role="status" aria-live="polite">
            <span className="social-home-loading-dot" />
            Loading more products…
          </div>
        ) : null}
        {feedPageError ? (
          <div className="social-home-state">
            <button type="button" onClick={() => void loadMoreFeed()}>
              Tap to load more products
            </button>
          </div>
        ) : null}
        {sorted.length ? (
          <section className="figma-home-for-you social-home-more-products">
            <SectionHeader title="More for you" />
            <div className="figma-home-product-grid">
              {[...items.slice(0, 16), ...extraProducts].map((product) => {
                const design = homeDesignProducts.find(
                  (d) =>
                    d.name === product.name &&
                    d.seller === product.seller.displayName,
                );
                return (
                  <article className="figma-home-product" key={product.id}>
                    <HomeLink
                      className="figma-home-product-media"
                      style={{ background: design?.background }}
                      href={`/product/${product.id}`}
                      aria-label={`View ${product.name}`}
                    >
                      <div>
                        {product.images[0] ? (
                          <ContentImage
                            width={196}
                            height={196}
                            sizes="(max-width: 440px) calc((100vw - 44px) / 2), 198px"
                            loading="lazy"
                            decoding="async"
                            src={product.images[0].url}
                            alt={product.images[0].altText ?? product.name}
                          />
                        ) : design ? (
                          <ContentImage
                            width={196}
                            height={196}
                            sizes="(max-width: 440px) calc((100vw - 44px) / 2), 198px"
                            loading="lazy"
                            decoding="async"
                            src={`/figma/${design.image}`}
                            alt={product.name}
                          />
                        ) : null}
                      </div>
                    </HomeLink>
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
                          active={isSaved(product.id)}
                        />
                      </span>
                    </button>
                    <div className="figma-home-product-copy">
                      <HomeLink
                        className="figma-home-product-seller"
                        href={`/seller/${product.seller.id}`}
                      >
                        {product.seller.displayName}
                      </HomeLink>
                      <HomeLink
                        className="figma-home-product-title"
                        href={`/product/${product.id}`}
                      >
                        {product.name}
                      </HomeLink>
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
          deferCartFetch
          prefetch={false}
          cartCount={homeState.cartCount}
        />
        {drawer ? <SideNavigation onClose={closeDrawer} /> : null}
      </main>
    </DesktopCustomerShell>
  );
}
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="figma-home-section-header">
      <h2>{title}</h2>
      <HomeLink href="/explore">See all</HomeLink>
    </div>
  );
}

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]