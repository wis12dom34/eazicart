/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { reelsApi, type Reel } from "../../lib/api/reels";
import { Icon } from "../components/icon";
import styles from "./reels.module.css";

const formatNaira = (value: string) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value));

const formatCount = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );

function ReelSlide({ reel, active }: { reel: Reel; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const product = reel.product;
  const sellerName =
    reel.seller?.displayName || reel.seller?.user?.name || reel.attribution || reel.source;
  const poster = reel.thumbnailUrl || product?.images[0]?.url || undefined;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      void video.play().catch(() => undefined);
      return;
    }
    video.pause();
  }, [active]);

  const shareReel = async () => {
    const url = reel.externalUrl || `${window.location.origin}/reels?reel=${reel.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: reel.caption || product?.name || "EaziCart Reel", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareStatus("Reel link copied");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setShareStatus("Unable to share reel");
    }
  };

  return (
    <article className={styles.slide} aria-label={reel.caption || product?.name || "Reel"}>
      {reel.videoUrl ? (
        <video
          ref={videoRef}
          className={styles.media}
          src={reel.videoUrl}
          poster={poster}
          muted
          loop
          playsInline
          preload={active ? "auto" : "metadata"}
        />
      ) : poster ? (
        <img
          className={styles.media}
          src={poster}
          alt={product?.name || reel.caption || `${reel.source} reel`}
        />
      ) : (
        <div className={styles.fallback} aria-label="Reel media unavailable">
          <Icon name="reels" size={64} />
        </div>
      )}

      <div className={styles.shade} />

      <div className={styles.top}>
        <strong>Reels</strong>
        <Link href="/explore" aria-label="Search products">
          <Icon name="search" />
        </Link>
      </div>

      <div className={styles.details}>
        <div className={styles.sellerRow}>
          {reel.seller ? (
            <Link
              className={styles.avatar}
              href={`/seller/${reel.seller.id}`}
              aria-label={`View ${sellerName} seller profile`}
            >
              {sellerName.slice(0, 1).toUpperCase()}
            </Link>
          ) : (
            <div className={styles.avatar} aria-hidden="true">
              {sellerName.slice(0, 1).toUpperCase()}
            </div>
          )}

          <div className={styles.sellerMeta}>
            {reel.seller ? (
              <Link className={styles.sellerName} href={`/seller/${reel.seller.id}`}>
                {sellerName}
              </Link>
            ) : (
              <strong className={styles.sellerName}>{sellerName}</strong>
            )}
            {reel.source !== "EAZICART" ? (
              <span className={styles.sourceLabel}>From {reel.source.toLowerCase()}</span>
            ) : null}
          </div>
        </div>

        {reel.caption ? <p className={styles.caption}>{reel.caption}</p> : null}
        {product ? (
          <>
            <strong className={styles.productName}>{product.name}</strong>
            <strong className={styles.price}>{formatNaira(product.price)}</strong>
          </>
        ) : null}

        {!reel.videoUrl && reel.externalUrl ? (
          <a
            className={styles.externalLink}
            href={reel.externalUrl}
            target="_blank"
            rel="noreferrer"
          >
            Watch original
          </a>
        ) : null}
      </div>

      <div className={styles.actions}>
        <button type="button" aria-label="Like reel" disabled>
          <Icon name="heart" />
          <span>{formatCount(reel._count.likes)}</span>
        </button>
        <button type="button" aria-label="Save reel" disabled>
          <Icon name="bookmark" />
          <span>{formatCount(reel._count.saves)}</span>
        </button>
        <button type="button" onClick={() => void shareReel()} aria-label="Share reel">
          <Icon name="share" />
          <span>Share</span>
        </button>
      </div>

      {shareStatus ? (
        <span className={styles.shareStatus} role="status">
          {shareStatus}
        </span>
      ) : null}

      {product ? (
        <Link className={styles.viewProduct} href={`/product/${product.id}`}>
          <span>View Product</span>
          <strong>{formatNaira(product.price)}</strong>
        </Link>
      ) : reel.externalUrl ? (
        <a
          className={styles.viewProduct}
          href={reel.externalUrl}
          target="_blank"
          rel="noreferrer"
        >
          <span>View original</span>
        </a>
      ) : null}
    </article>
  );
}

export default function ReelsPage() {
  const feedRef = useRef<HTMLElement | null>(null);
  const loadingMoreRef = useRef(false);
  const [reels, setReels] = useState<Reel[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (cursor?: string) => {
    const response = await reelsApi.feed({ cursor, limit: 8 });
    setReels((current) => {
      if (!cursor) return response.data;
      const known = new Set(current.map((reel) => reel.id));
      return [...current, ...response.data.filter((reel) => !known.has(reel.id))];
    });
    setNextCursor(response.pagination.nextCursor);
    setHasMore(response.pagination.hasMore);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadPage()
      .then(() => {
        if (active) setError(null);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(
          requestError instanceof Error ? requestError.message : "Unable to load reels",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await loadPage(nextCursor);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loadPage, nextCursor]);

  const onScroll = () => {
    const feed = feedRef.current;
    if (!feed) return;
    const height = feed.clientHeight || 1;
    const index = Math.max(0, Math.min(reels.length - 1, Math.round(feed.scrollTop / height)));
    setActiveIndex(index);
    if (index >= reels.length - 3) void loadMore();
  };

  if (loading) {
    return (
      <main className={`${styles.page} ${styles.state}`}>
        <div className={styles.stateTop}>
          <strong>Reels</strong>
          <Icon name="search" />
        </div>
        <p>Loading reels…</p>
      </main>
    );
  }

  if (error || reels.length === 0) {
    return (
      <main className={`${styles.page} ${styles.state}`}>
        <div className={styles.stateTop}>
          <strong>Reels</strong>
          <Icon name="search" />
        </div>
        <p>{error ?? "No reels have been published yet."}</p>
      </main>
    );
  }

  return (
    <main ref={feedRef} className={styles.page} onScroll={onScroll}>
      {reels.map((reel, index) => (
        <ReelSlide key={reel.id} reel={reel} active={index === activeIndex} />
      ))}
      {loadingMore ? <div className={styles.loadingMore}>Loading more reels…</div> : null}
    </main>
  );
}
