"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductGrid } from "../../components/product-card";
import { ErrorState, LoadingState } from "../../components/async-state";
import { Icon } from "../../components/icon";
import { sellersApi } from "../../../lib/api/sellers";
import { followsApi } from "../../../lib/api/follows";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
import styles from "./seller-profile.module.css";

type SellerTab = "products" | "about" | "reviews";

export default function SellerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const auth = useAuth();
  const router = useRouter();
  const seller = useRequest(() => sellersApi.get(id), [id]);
  const follows = useRequest(
    async () =>
      auth.isAuthenticated ? followsApi.list() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const products = useRequest(() => sellersApi.products(id), [id]);
  const count = useRequest(
    () => followsApi.count(seller.data?.data.userId ?? id),
    [seller.data?.data.userId, id],
  );
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<SellerTab>("products");

  const following = Boolean(
    follows.data?.data.some((follow) => follow.sellerId === seller.data?.data.userId),
  );

  if (seller.loading) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <SellerBackLink />
        <LoadingState />
      </main>
    );
  }

  if (seller.error || !seller.data) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <SellerBackLink />
        <ErrorState message={seller.error || "Seller not found"} />
      </main>
    );
  }

  const currentSeller = seller.data.data;
  const productCount =
    currentSeller._count?.products ?? products.data?.data.length ?? 0;
  const followerCount =
    count.data?.data.count ?? currentSeller.followerCount ?? 0;
  const initials = currentSeller.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

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
      await count.reload();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update follow",
      );
    }
  };

  return (
    <main className={`app-shell ${styles.page}`}>
      <SellerBackLink />

      <section className={styles.intro}>
        <h1>{currentSeller.displayName}</h1>
        <p>Seller storefront</p>
      </section>

      <section className={styles.summaryCard} aria-label="Seller summary">
        <div className={styles.avatar} aria-hidden="true">
          {initials || "S"}
        </div>
        <div className={styles.summaryContent}>
          <div className={styles.summaryHeading}>
            <h2>{currentSeller.displayName}</h2>
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
          <p className={styles.metrics}>
            {followerCount} {followerCount === 1 ? "follower" : "followers"} ·{" "}
            {productCount} {productCount === 1 ? "product" : "products"}
          </p>
          {currentSeller.bio ? (
            <p className={styles.bio}>{currentSeller.bio}</p>
          ) : null}
        </div>
      </section>

      {message ? (
        <p className={styles.alert} role="alert">
          {message}
        </p>
      ) : null}

      <div className={styles.tabs} role="tablist" aria-label="Seller profile sections">
        <SellerTabButton
          label="Products"
          tab="products"
          activeTab={activeTab}
          onSelect={setActiveTab}
        />
        <SellerTabButton
          label="About"
          tab="about"
          activeTab={activeTab}
          onSelect={setActiveTab}
        />
        <SellerTabButton
          label="Reviews"
          tab="reviews"
          activeTab={activeTab}
          onSelect={setActiveTab}
        />
      </div>

      <section
        className={styles.panel}
        id="seller-products-panel"
        role="tabpanel"
        aria-labelledby="seller-products-tab"
        hidden={activeTab !== "products"}
      >
        <div className={styles.panelHeader}>
          <h2>Products</h2>
          <span>{productCount} available</span>
        </div>
        {products.loading ? (
          <LoadingState />
        ) : products.error ? (
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
              <strong>{followerCount}</strong>
              <span>{followerCount === 1 ? "Follower" : "Followers"}</span>
            </div>
            <div>
              <strong>{productCount}</strong>
              <span>{productCount === 1 ? "Product" : "Products"}</span>
            </div>
          </div>
        </div>
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
    </main>
  );
}

function SellerBackLink() {
  return (
    <header className={styles.topbar}>
      <Link className={styles.back} href="/explore" aria-label="Go back">
        <Icon name="back" />
      </Link>
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
