/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { reelsApi, type Reel } from "../../lib/api/reels";
import { BottomNavigation } from "../components/bottom-navigation";
import styles from "./reels.module.css";

const formatNaira = (value: string) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value));

const formatCount = (value: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

function ReelSlide({ reel, active }: { reel: Reel; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const product = reel.product;
  const sellerName =
    reel.seller?.displayName ||
    reel.seller?.user?.name ||
    reel.attribution ||
    reel.source;
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
    const url =
      reel.externalUrl || `${window.location.origin}/reels?reel=${reel.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: reel.caption || product?.name || "EaziCart Reel",
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareStatus("Reel link copied");
    } catch (shareError) {
      if (
        shareError instanceof DOMException &&
        shareError.name === "AbortError"
      )
        return;
      setShareStatus("Unable to share reel");
    }
  };

  return (
    <article
      className={styles.slide}
      aria-label={reel.caption || product?.name || "Reel"}
    >
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
        <div className={styles.fallback} aria-label="Reel media unavailable" />
      )}

      <div className={styles.bottomShade} />

      <div className={styles.details}>
        {reel.seller ? (
          <Link
            className={styles.avatar}
            href={`/seller/${reel.seller.id}`}
            aria-label={`View ${sellerName} seller profile`}
          >
            {sellerName.slice(0, 1).toUpperCase()}
          </Link>
        ) : (
          <span className={styles.avatar} aria-hidden="true">
            {sellerName.slice(0, 1).toUpperCase()}
          </span>
        )}
        {reel.seller ? (
          <Link
            className={styles.sellerName}
            href={`/seller/${reel.seller.id}`}
          >
            {sellerName}
          </Link>
        ) : (
          <strong className={styles.sellerName}>{sellerName}</strong>
        )}
      </div>

      {reel.caption ? <p className={styles.caption}>{reel.caption}</p> : null}
      {product ? (
        <strong className={styles.productName}>{product.name}</strong>
      ) : reel.source !== "EAZICART" ? (
        <strong className={styles.productName}>
          From {reel.source.toLowerCase()}
        </strong>
      ) : null}

      <div className={styles.actions}>
        <button
          className={styles.action}
          disabled
          aria-label="Like reel: interaction service unavailable"
        >
          <i>
            <img src="/figma/reel-like.svg" width={20} height={20} alt="" />
          </i>
          <span>{formatCount(reel._count.likes)}</span>
        </button>
        <button
          className={styles.action}
          disabled
          aria-label="Reel comments: interaction service unavailable"
        >
          <i>
            <img src="/figma/reel-comment.svg" width={20} height={20} alt="" />
          </i>
          <span>{formatCount(reel._count.comments)}</span>
        </button>
        <button
          className={styles.action}
          disabled
          aria-label="Save reel: interaction service unavailable"
        >
          <i>
            <img src="/figma/reel-save.svg" width={20} height={20} alt="" />
          </i>
          <small>{formatCount(reel._count.saves)}</small>
        </button>
        <button
          className={styles.action}
          onClick={() => void shareReel()}
          aria-label="Share reel"
        >
          <i>
            <img src="/figma/reel-share.svg" width={20} height={20} alt="" />
          </i>
          <small>Share</small>
        </button>
        <Link className={styles.action} href="/cart" aria-label="Open cart">
          <i>
            <img src="/figma/reel-cart.svg" width={22} height={22} alt="" />
          </i>
          <small>Cart</small>
        </Link>
      </div>

      {shareStatus ? (
        <span className={styles.shareStatus} role="status">
          {shareStatus}
        </span>
      ) : null}

      {product ? (
        <Link className={styles.viewProduct} href={`/product/${product.id}`}>
          <strong>{formatNaira(product.price)}</strong>
          <span>View Product</span>
        </Link>
      ) : reel.externalUrl ? (
        <a
          className={styles.viewProduct}
          href={reel.externalUrl}
          target="_blank"
          rel="noreferrer"
        >
          <strong>Original source</strong>
          <span>View Reel</span>
        </a>
      ) : null}
    </article>
  );
}

export default function ReelsPage() {
  const feedRef = useRef<HTMLDivElement | null>(null);
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
      return [
        ...current,
        ...response.data.filter((reel) => !known.has(reel.id)),
      ];
    });
    setNextCursor(response.pagination.nextCursor);
    setHasMore(response.pagination.hasMore);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadPage()
      .then(() => {
        if (mounted) setError(null);
      })
      .catch((requestError: unknown) => {
        if (!mounted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load reels",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
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
    const index = Math.max(
      0,
      Math.min(reels.length - 1, Math.round(feed.scrollTop / height)),
    );
    setActiveIndex(index);
    if (index >= reels.length - 3) void loadMore();
  };

  return (
    <main className={`app-shell ${styles.page}`} data-figma-node="223:51">
      <div ref={feedRef} className={styles.viewport} onScroll={onScroll}>
        {loading ? (
          <p className={styles.state} role="status">
            Loading reels…
          </p>
        ) : error || reels.length === 0 ? (
          <p className={styles.state} role={error ? "alert" : "status"}>
            {error ?? "No reels have been published yet."}
          </p>
        ) : (
          reels.map((reel, index) => (
            <ReelSlide
              key={reel.id}
              reel={reel}
              active={index === activeIndex}
            />
          ))
        )}
        {loadingMore ? (
          <div className={styles.loadingMore}>Loading more reels…</div>
        ) : null}
      </div>

      <div className={styles.topShade} />
      <header className={styles.header}>
        <Link href="/" className={styles.back} aria-label="Back to home">
          <img src="/figma/reel-back.svg" width={20} height={20} alt="" />
        </Link>
        <h1>Reels</h1>
        <Link
          href="/explore"
          className={styles.search}
          aria-label="Search products"
        >
          <img src="/figma/reel-search.svg" width={20} height={20} alt="" />
        </Link>
      </header>

      <BottomNavigation activeHref="/reels" />
    </main>
  );
}
