"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductGrid } from "../../components/product-card";
import { ErrorState, LoadingState } from "../../components/async-state";
import { BottomNavigation } from "../../components/bottom-navigation";
import { ProfileAvatar } from "../../components/profile-avatar";
import { Icon } from "../../components/icon";
import { sellersApi } from "../../../lib/api/sellers";
import { followsApi } from "../../../lib/api/follows";
import { reelsApi } from "../../../lib/api/reels";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
import styles from "./seller-profile.module.css";
import type { Product, Seller } from "../../../lib/api/types";

type SellerTab = "products" | "reels" | "reviews" | "about";

const compactNumber = (value: number) =>
  new Intl.NumberFormat("en", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);

export default function SellerPage({
  id,
  initialSeller,
  initialProducts,
  initialError = "",
}: {
  id: string;
  initialSeller?: Seller;
  initialProducts?: Product[];
  initialError?: string;
}) {
  const auth = useAuth();
  const router = useRouter();
  const seller = useRequest(
    () => sellersApi.get(id),
    [id],
    initialSeller ? { data: initialSeller } : undefined,
    initialError,
  );
  const follows = useRequest(
    async () =>
      auth.isAuthenticated ? followsApi.list() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const products = useRequest(
    () => sellersApi.products(id),
    [id],
    initialProducts ? { data: initialProducts } : undefined,
    initialError,
  );
  const reels = useRequest(() => reelsApi.feed({ limit: 20 }), [id]);
  const followerCountRequest = useRequest(
    () => followsApi.count(seller.data?.data.userId ?? id),
    [seller.data?.data.userId, id],
  );
  const followingCountRequest = useRequest(
    () => followsApi.followingCount(seller.data?.data.userId ?? id),
    [seller.data?.data.userId, id],
  );
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<SellerTab>("products");

  const following = Boolean(
    follows.data?.data.some(
      (follow) => follow.sellerId === seller.data?.data.userId,
    ),
  );

  if (seller.loading && !seller.data) {
    return (
      <main className={`app-shell with-nav ${styles.page}`}>
        <SellerTopbar title="Seller" />
        <LoadingState />
        <BottomNavigation activeHref="/explore" />
      </main>
    );
  }

  if (!seller.data) {
    return (
      <main className={`app-shell with-nav ${styles.page}`}>
        <SellerTopbar title="Seller" />
        <section className={styles.errorPage}>
          <h1>Store details temporarily unavailable</h1>
          <p>Browse other products while we reconnect to this storefront.</p>
          <Link href="/explore">Explore products</Link>
          <ErrorState message={seller.error || "Seller not found"} />
        </section>
        <BottomNavigation activeHref="/explore" />
      </main>
    );
  }

  const currentSeller = seller.data.data;
  const productCount =
    currentSeller._count?.products ?? products.data?.data.length ?? 0;
  const sellerReels = (reels.data?.data ?? []).filter(
    (reel) => reel.seller?.id === id || reel.product?.seller.id === id,
  );
  const followerCount =
    followerCountRequest.data?.data.count ?? currentSeller.followerCount ?? 0;
  const followingCount = followingCountRequest.data?.data.count ?? 0;

  const follow = async () => {
    if (!auth.isAuthenticated) {
      router.push(`/login?next=/seller/${id}`);
      return;
    }

    try {
      setMessage("");
      if (following) await followsApi.unfollow(currentSeller.userId);
      else await followsApi.follow(currentSeller.userId);
      await follows.reload();
      await followerCountRequest.reload();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update follow",
      );
    }
  };

  const shareStore = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: currentSeller.displayName, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMessage("Store link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Unable to share this store right now");
    }
  };

  return (
    <main className={`app-shell with-nav ${styles.page}`}>
      <SellerTopbar title={currentSeller.displayName} onShare={shareStore} />

      <section className={styles.storefrontHeader} aria-label="Seller profile">
        <div className={styles.cover} aria-hidden="true" />
        <div className={styles.profileBody}>
          <div className={styles.profileTopRow}>
            <div className={styles.storyRing}>
              <div className={styles.avatar}>
                <ProfileAvatar
                  userId={currentSeller.userId}
                  name={currentSeller.displayName}
                />
              </div>
            </div>
            <div className={styles.actions}>
              <Link className={styles.messageButton} href="/chat">
                Message
              </Link>
              <button
                className={`${styles.followButton} ${following ? styles.following : ""}`}
                type="button"
                disabled={auth.loading || follows.loading}
                aria-pressed={following}
                onClick={() => void follow()}
              >
                {following ? "Following" : "Follow"}
              </button>
            </div>
          </div>

          <div className={styles.identity}>
            <h1>{currentSeller.displayName}</h1>
            <p className={styles.handle}>Seller storefront</p>
            {currentSeller.bio ? (
              <p className={styles.bio}>{currentSeller.bio}</p>
            ) : null}
            {currentSeller.location?.label ? (
              <p className={styles.location}>
                <span aria-hidden="true">◎</span>
                {currentSeller.location.label}
              </p>
            ) : null}
          </div>

          <div className={styles.socialStats} aria-label="Seller social stats">
            <span>
              <strong>{compactNumber(followingCount)}</strong> Following
            </span>
            <span>
              <strong>{compactNumber(followerCount)}</strong> Followers
            </span>
          </div>

          <div className={styles.performance} aria-label="Store activity">
            <span>{compactNumber(productCount)} Products</span>
            <span>{compactNumber(sellerReels.length)} Reels</span>
            <span>On EaziCart</span>
          </div>
        </div>
      </section>

      {message ? (
        <p className={styles.alert} role="status">
          {message}
        </p>
      ) : null}

      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Seller profile sections"
      >
        <SellerTabButton
          label="Products"
          tab="products"
          activeTab={activeTab}
          onSelect={setActiveTab}
        />
        <SellerTabButton
          label="Reels"
          tab="reels"
          activeTab={activeTab}
          onSelect={setActiveTab}
        />
        <SellerTabButton
          label="Reviews"
          tab="reviews"
          activeTab={activeTab}
          onSelect={setActiveTab}
        />
        <SellerTabButton
          label="About"
          tab="about"
          activeTab={activeTab}
          onSelect={setActiveTab}
        />
      </div>

      <section
        className={`${styles.panel} ${styles.productsPanel}`}
        id="seller-products-panel"
        role="tabpanel"
        aria-labelledby="seller-products-tab"
        hidden={activeTab !== "products"}
      >
        {products.loading && !products.data ? (
          <LoadingState />
        ) : products.error && !products.data ? (
          <ErrorState
            message={products.error}
            retry={() => void products.reload()}
          />
        ) : products.data?.data.length ? (
          <ProductGrid products={products.data.data} />
        ) : (
          <div className={styles.productEmpty}>
            <p>No products are available from this seller yet.</p>
          </div>
        )}
      </section>

      <section
        className={styles.panel}
        id="seller-reels-panel"
        role="tabpanel"
        aria-labelledby="seller-reels-tab"
        hidden={activeTab !== "reels"}
      >
        {reels.loading ? (
          <LoadingState label="Loading reels…" />
        ) : reels.error ? (
          <ErrorState message={reels.error} retry={() => void reels.reload()} />
        ) : sellerReels.length ? (
          <div className={styles.reelGrid}>
            {sellerReels.map((reel) => (
              <Link
                className={styles.reelCard}
                href={`/reels?reel=${encodeURIComponent(reel.id)}`}
                key={reel.id}
              >
                <div className={styles.reelMedia}>
                  {reel.thumbnailUrl || reel.product?.images[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={
                        reel.thumbnailUrl ?? reel.product?.images[0]?.url ?? ""
                      }
                      alt=""
                    />
                  ) : (
                    <span className={styles.reelFallback} aria-hidden="true">
                      ▶
                    </span>
                  )}
                  <span className={styles.reelTitle}>
                    {reel.caption || reel.product?.name || "Reel"}
                  </span>
                  <span className={styles.reelViews}>
                    ▶ {compactNumber(reel._count.views)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.emptyCard}>
            <h2>No Reels yet</h2>
            <p>This seller has not published any Reels.</p>
          </div>
        )}
      </section>

      <section
        className={styles.panel}
        id="seller-reviews-panel"
        role="tabpanel"
        aria-labelledby="seller-reviews-tab"
        hidden={activeTab !== "reviews"}
      >
        <div className={styles.emptyCard}>
          <h2>Reviews</h2>
          <p>Seller reviews are not available yet.</p>
        </div>
      </section>

      <section
        className={styles.panel}
        id="seller-about-panel"
        role="tabpanel"
        aria-labelledby="seller-about-tab"
        hidden={activeTab !== "about"}
      >
        <div className={styles.aboutCard}>
          <h2>About {currentSeller.displayName}</h2>
          <p>
            {currentSeller.bio || "This seller has not added a store bio yet."}
          </p>
          <div className={styles.aboutStats}>
            <div>
              <strong>{compactNumber(followerCount)}</strong>
              <span>Followers</span>
            </div>
            <div>
              <strong>{compactNumber(productCount)}</strong>
              <span>Products</span>
            </div>
          </div>
        </div>
      </section>

      <BottomNavigation activeHref="/explore" />
    </main>
  );
}

function SellerTopbar({
  title,
  onShare,
}: {
  title: string;
  onShare?: () => Promise<void>;
}) {
  return (
    <header className={styles.topbar}>
      <Link className={styles.back} href="/explore" aria-label="Go back">
        <Icon name="back" size={20} />
      </Link>
      <strong className={styles.topbarTitle}>{title}</strong>
      <Link
        className={styles.searchButton}
        href={`/search?q=${encodeURIComponent(title)}`}
        aria-label={`Search ${title}`}
      >
        <Icon name="search" size={20} />
      </Link>
      <button
        className={styles.moreButton}
        type="button"
        aria-label="Share store"
        disabled={!onShare}
        onClick={() => void onShare?.()}
      >
        <span aria-hidden="true">•••</span>
      </button>
    </header>
  );
}

function SellerTabButton({
  label,
  tab,
  activeTab,
  onSelect,
}: {
  label: string;
  tab: SellerTab;
  activeTab: SellerTab;
  onSelect: (tab: SellerTab) => void;
}) {
  const active = activeTab === tab;
  return (
    <button
      className={`${styles.tab} ${active ? styles.activeTab : ""}`}
      id={`seller-${tab}-tab`}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`seller-${tab}-panel`}
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect(tab)}
    >
      {label}
    </button>
  );
}
