/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { reelsApi, type Reel, type ReelComment } from "../../lib/api/reels";
import { BottomNavigation } from "../components/bottom-navigation";
import { useAuth } from "../providers/auth-provider";
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
  authenticated,
  authLoading,
  onRequireAuth,
}: {
  reel: Reel;
  open: boolean;
  onClose: () => void;
  onCommentAdded: () => void;
  authenticated: boolean;
  authLoading: boolean;
  onRequireAuth: () => void;
}) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const legacy = isLegacyReel(reel);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusableElements = Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusableElements.length) return;

      const first = focusableElements[0]!;
      const last = focusableElements[focusableElements.length - 1]!;
      const activeElement = document.activeElement;
      if (!sheet.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocusedElement?.isConnected)
        previouslyFocusedElement.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || legacy) return;
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
  }, [legacy, open, reel.id]);

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
        ref={sheetRef}
        className={styles.commentsSheet}
        role="dialog"
        aria-modal="true"
        aria-label="Reel comments"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.sheetHeader}>
          <strong>Comments</strong>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close comments"
          >
            ×
          </button>
        </div>

        <div className={styles.commentList}>
          {legacy ? (
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

        {!legacy ? (
          authenticated ? (
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
          ) : (
            <div className={styles.commentSignIn}>
              <button
                type="button"
                onClick={onRequireAuth}
                disabled={authLoading}
              >
                {authLoading ? "Checking account…" : "Sign in to comment"}
              </button>
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}

function ReelSlide({
  reel,
  active,
  onCountChange,
  authenticated,
  authLoading,
}: {
  reel: Reel;
  active: boolean;
  authenticated: boolean;
  authLoading: boolean;
  onCountChange: (
    reelId: string,
    key: keyof Reel["_count"],
    value: number,
  ) => void;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewedRef = useRef(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [interactionStatus, setInteractionStatus] = useState<string | null>(
    null,
  );
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [interactionStateBusy, setInteractionStateBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const closeComments = useCallback(() => setCommentsOpen(false), []);
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
    if (!active || !interactive || !authenticated || viewedRef.current) return;
    let retryTimeout: number | null = null;
    let cancelled = false;
    let attempts = 0;

    const recordView = () => {
      if (cancelled || viewedRef.current) return;
      attempts += 1;
      void reelsApi
        .view(reel.id, 1500, false)
        .then(() => {
          viewedRef.current = true;
        })
        .catch(() => {
          if (cancelled || viewedRef.current || attempts >= 2) return;
          retryTimeout = window.setTimeout(recordView, 1500);
        });
    };

    const timeout = window.setTimeout(recordView, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      if (retryTimeout !== null) window.clearTimeout(retryTimeout);
    };
  }, [active, authenticated, interactive, reel.id]);

  useEffect(() => {
    if (!active || !interactive || !authenticated) {
      if (!authenticated) {
        setLiked(false);
        setSaved(false);
      }
      return;
    }
    let mounted = true;
    setInteractionStateBusy(true);
    reelsApi
      .interactions(reel.id)
      .then((response) => {
        if (!mounted) return;
        setLiked(response.data.liked);
        setSaved(response.data.saved);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setInteractionStateBusy(false);
      });
    return () => {
      mounted = false;
    };
  }, [active, authenticated, interactive, reel.id]);

  useEffect(() => {
    if (!shareStatus && !interactionStatus) return;
    const timeout = window.setTimeout(() => {
      setShareStatus(null);
      setInteractionStatus(null);
    }, 2200);
    return () => window.clearTimeout(timeout);
  }, [interactionStatus, shareStatus]);

  const requireAuth = () => {
    const next = `/reels?reel=${encodeURIComponent(reel.id)}`;
    router.push(`/login?next=${encodeURIComponent(next)}`);
  };

  const shareReel = async () => {
    const url = `${window.location.origin}/reels?reel=${encodeURIComponent(reel.id)}`;
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
    if (!interactive || likeBusy || authLoading) return;
    if (!authenticated) {
      requireAuth();
      return;
    }
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
    if (!interactive || saveBusy || authLoading) return;
    if (!authenticated) {
      requireAuth();
      return;
    }
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
          disabled={
            !interactive || likeBusy || interactionStateBusy || authLoading
          }
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
          disabled={
            !interactive || saveBusy || interactionStateBusy || authLoading
          }
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
        onClose={closeComments}
        onCommentAdded={() =>
          onCountChange(reel.id, "comments", reel._count.comments + 1)
        }
        authenticated={authenticated}
        authLoading={authLoading}
        onRequireAuth={requireAuth}
      />
    </article>
  );
}

export default function ReelsPage() {
  const auth = useAuth();
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
    const search = new URLSearchParams(window.location.search);
    const productId = search.get("productId");
    const reelId = search.get("reel");
    const response = await reelsApi.feed({
      cursor,
      limit: reelId ? 1 : 8,
      productId: reelId ? undefined : (productId ?? undefined),
      reelId: reelId ?? undefined,
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
              authenticated={auth.isAuthenticated}
              authLoading={auth.loading}
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
