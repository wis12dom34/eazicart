/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  reelsApi,
  type Reel,
  type ReelComment,
} from "../../lib/api/reels";
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

const isLegacyReel = (reel: Reel) => reel.id.startsWith("legacy-product-");

function CommentsSheet({
  reel,
  open,
  onClose,
  onCommentAdded,
}: {
  reel: Reel;
  open: boolean;
  onClose: () => void;
  onCommentAdded: () => void;
}) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || isLegacyReel(reel)) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    reelsApi
      .comments(reel.id)
      .then((response) => {
        if (mounted) setComments(response.data);
      })
      .catch((requestError: unknown) => {
        if (!mounted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load comments",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, reel]);

  if (!open) return null;

  const submitComment = async () => {
    const message = body.trim();
    if (!message || posting || isLegacyReel(reel)) return;
    setPosting(true);
    setError(null);
    try {
      const response = await reelsApi.comment(reel.id, message);
      setComments((current) => [...current, response.data]);
      setBody("");
      onCommentAdded();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to post comment",
      );
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className={styles.sheetLayer} role="presentation" onClick={onClose}>
      <section
        className={styles.commentsSheet}
        role="dialog"
        aria-modal="true"
        aria-label="Reel comments"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.sheetHeader}>
          <strong>Comments</strong>
          <button type="button" onClick={onClose} aria-label="Close comments">
            ×
          </button>
        </div>

        <div className={styles.commentList}>
          {isLegacyReel(reel) ? (
            <p className={styles.sheetState}>
              Comments are available on published Reels.
            </p>
          ) : loading ? (
            <p className={styles.sheetState}>Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className={styles.sheetState}>No comments yet. Be the first.</p>
          ) : (
            comments.map((comment) => (
              <article key={comment.id} className={styles.comment}>
                <span className={styles.commentAvatar} aria-hidden="true">
                  {(comment.user.name || "U").slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{comment.user.name || "EaziCart user"}</strong>
                  <p>{comment.body}</p>
                </div>
              </article>
            ))
          )}
        </div>

        {error ? (
          <p className={styles.sheetError} role="alert">
            {error}
          </p>
        ) : null}

        {!isLegacyReel(reel) ? (
          <form
            className={styles.commentComposer}
            onSubmit={(event) => {
              event.preventDefault();
              void submitComment();
            }}
          >
            <input
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1000}
              placeholder="Add a comment…"
              aria-label="Comment"
            />
            <button type="submit" disabled={!body.trim() || posting}>
              {posting ? "…" : "Post"}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function ReelSlide({
  reel,
  active,
  onCountChange,
}: {
  reel: Reel;
  active: boolean;
  onCountChange: (reelId: string, key: keyof Reel["_count"], value: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewedRef = useRef(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [interactionStatus, setInteractionStatus] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const product = reel.product;
  const interactive = !isLegacyReel(reel);
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

  useEffect(() => {
    if (!active || !interactive || viewedRef.current) return;
    const timeout = window.setTimeout(() => {
      viewedRef.current = true;
      void reelsApi.view(reel.id, 1500, false).catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [active, interactive, reel.id]);

  useEffect(() => {
    if (!shareStatus && !interactionStatus) return;
    const timeout = window.setTimeout(() => {
      setShareStatus(null);
      setInteractionStatus(null);
    }, 2200);
    return () => window.clearTimeout(timeout);
  }, [interactionStatus, shareStatus]);

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

  const toggleLike = async () => {
    if (!interactive || likeBusy) return;
    setLikeBusy(true);
    setInteractionStatus(null);
    try {
      const response = liked
        ? await reelsApi.unlike(reel.id)
        : await reelsApi.like(reel.id);
      setLiked(response.data.liked);
      onCountChange(reel.id, "likes", response.data.count);
    } catch (requestError) {
      setInteractionStatus(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update like",
      );
    } finally {
      setLikeBusy(false);
    }
  };

  const toggleSave = async () => {
    if (!interactive || saveBusy) return;
    setSaveBusy(true);
    setInteractionStatus(null);
    try {
      const response = saved
        ? await reelsApi.unsave(reel.id)
        : await reelsApi.save(reel.id);
      setSaved(response.data.saved);
      onCountChange(reel.id, "saves", response.data.count);
    } catch (requestError) {
      setInteractionStatus(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update save",
      );
    } finally {
      setSaveBusy(false);
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
          className={`${styles.action} ${liked ? styles.actionActive : ""}`}
          disabled={!interactive || likeBusy}
          aria-label={liked ? "Unlike reel" : "Like reel"}
          aria-pressed={liked}
          onClick={() => void toggleLike()}
        >
          <i>
            <img src="/figma/reel-like.svg" width={20} height={20} alt="" />
          </i>
          <span>{formatCount(reel._count.likes)}</span>
        </button>
        <button
          className={styles.action}
          disabled={!interactive}
          aria-label="Open reel comments"
          onClick={() => setCommentsOpen(true)}
        >
          <i>
            <img src="/figma/reel-comment.svg" width={20} height={20} alt="" />
          </i>
          <span>{formatCount(reel._count.comments)}</span>
        </button>
        <button
          className={`${styles.action} ${saved ? styles.actionActive : ""}`}
          disabled={!interactive || saveBusy}
          aria-label={saved ? "Remove saved reel" : "Save reel"}
          aria-pressed={saved}
          onClick={() => void toggleSave()}
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

      {shareStatus || interactionStatus ? (
        <span className={styles.shareStatus} role="status">
          {shareStatus || interactionStatus}
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

      <CommentsSheet
        reel={reel}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommentAdded={() =>
          onCountChange(reel.id, "comments", reel._count.comments + 1)
        }
      />
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
    const productId = new URLSearchParams(window.location.search).get(
      "productId",
    );
    const response = await reelsApi.feed({
      cursor,
      limit: 8,
      productId: productId ?? undefined,
    });
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

  const onCountChange = useCallback(
    (reelId: string, key: keyof Reel["_count"], value: number) => {
      setReels((current) =>
        current.map((reel) =>
          reel.id === reelId
            ? { ...reel, _count: { ...reel._count, [key]: value } }
            : reel,
        ),
      );
    },
    [],
  );

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
              onCountChange={onCountChange}
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
