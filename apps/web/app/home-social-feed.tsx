"use client";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { ContentImage } from "./components/content-image";
import { Icon } from "./components/icon";
import type { Product } from "../lib/api/types";
import { ProfileAvatar } from "./components/profile-avatar";
import { money } from "./data";
import { cartApi } from "../lib/api/cart";
import { productsApi } from "../lib/api/products";
import { followsApi } from "../lib/api/follows";
import { reelsApi, type Reel } from "../lib/api/reels";
import { useProductSocial } from "./hooks/use-product-social";
import { useAuth } from "./providers/auth-provider";
import { productSocialApi, type ProductComment } from "../lib/api/product-social";
import { uploadSocialMedia } from "../lib/social-media";

let followCache: { account: string | undefined; sellerIds: Set<string>; loaded: boolean; request?: Promise<void> } = { account: undefined, sellerIds: new Set(), loaded: false };
function HomeLink(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />;
}

const ensureFollowCache = (account: string | undefined) => {
  if (followCache.account !== account) followCache = { account, sellerIds: new Set(), loaded: !account };
  if (!account || followCache.loaded) return Promise.resolve();
  if (!followCache.request) {
    followCache.request = followsApi.list().then((result) => {
      followCache.sellerIds = new Set(result.data.map((row) => row.sellerId));
      followCache.loaded = true;
    }).catch(() => undefined).finally(() => { followCache.request = undefined; });
  }
  return followCache.request;
};
function FeedSignal({ productId, children }: { productId: string; children: React.ReactNode }) {
  const auth = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const entered = useRef<number | null>(null);
  const sentView = useRef(false);
  useEffect(() => {
    if (!auth.isAuthenticated || !ref.current) return;
    const node = ref.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
        entered.current ??= Date.now();
        if (!sentView.current) { sentView.current = true; void productsApi.feedEvent(productId, "VIEW").catch(() => undefined); }
      } else if (entered.current) {
        const dwell = Date.now() - entered.current; entered.current = null;
        if (dwell >= 2000) void productsApi.feedEvent(productId, "DWELL", dwell).catch(() => undefined);
      }
    }, { threshold: [0, 0.55] });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (entered.current) { const dwell = Date.now() - entered.current; if (dwell >= 2000) void productsApi.feedEvent(productId, "DWELL", dwell).catch(() => undefined); }
    };
  }, [auth.isAuthenticated, productId]);
  return <div ref={ref} data-feed-product={productId}>{children}</div>;
}
function commentTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24); if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7); if (weeks < 5) return `${weeks}w`;
  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}
function FeedCommentsButton({ productId, count }: { productId: string; count?: number }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [visibleCount, setVisibleCount] = useState(count ?? 0);
  const [loading, setLoading] = useState(false);
  const commentsCache = useRef<{ data: ProductComment[]; nextCursor: string | null; hasMore: boolean; fetchedAt: number } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [body, setBody] = useState("");
  const draftKey = `eazicart:comment-draft:${productId}`;
  const [posting, setPosting] = useState(false);
  const [media, setMedia] = useState<{ url: string; type: "image" | "gif" } | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const remainingChars = 1000 - body.length;
  const [error, setError] = useState<{ message: string; kind: "load" | "action" } | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setVisibleCount(count ?? 0); }, [count]);
  useEffect(() => {
    if (!open) return;
    try { const draft = sessionStorage.getItem(draftKey); if (draft && !body) setBody(draft); } catch {}
  }, [open, draftKey]);
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => { try { if (body.trim()) sessionStorage.setItem(draftKey, body); else sessionStorage.removeItem(draftKey); } catch {} }, 180);
    return () => window.clearTimeout(id);
  }, [body, open, draftKey]);
  const sheetRef = useRef<HTMLElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartX = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const cached = commentsCache.current;
    if (cached && Date.now() - cached.fetchedAt < 30_000) {
      setComments(cached.data); setNextCursor(cached.nextCursor); setHasMore(cached.hasMore); setLoading(false); setError(null);
      return () => { active = false; };
    }
    setLoading(true); setError(null);
    void productSocialApi.comments(productId, undefined, Boolean(auth.user)).then((r) => { if (active) { commentsCache.current = { data: r.data, nextCursor: r.pagination.nextCursor, hasMore: r.pagination.hasMore, fetchedAt: Date.now() }; setComments(r.data); setVisibleCount((current) => Math.max(current, r.data.length)); setNextCursor(r.pagination.nextCursor); setHasMore(r.pagination.hasMore); } }).catch(() => { if (active) setError({ message: "Couldn't load comments. Tap to retry.", kind: "load" }); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, productId]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", close);
    const sheet = sheetRef.current;
    window.setTimeout(() => {
      const first = sheet?.querySelector<HTMLElement>('header button, input, button, a[href]');
      first?.focus({ preventScroll: true });
    }, 0);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", close); window.setTimeout(() => triggerRef.current?.focus({ preventScroll: true }), 0); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter((node) => !node.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [open]);
  const uploadCommentMedia = async (file: File | undefined) => {
    if (!file || !auth.user || mediaBusy) return;
    setMediaBusy(true); setError(null);
    try {
      const item = await uploadSocialMedia("comment", auth.user.id, file);
      setMedia({ url: item.url, type: file.type === "image/gif" || /\.gif$/i.test(file.name) ? "gif" : "image" });
    } catch (error) {
      setError({ message: error instanceof Error ? error.message : "Couldn't upload that image. Try again.", kind: "action" });
    } finally { setMediaBusy(false); }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); const text = body.trim(); if ((!text && !media) || !auth.user || posting || mediaBusy) return;
    setPosting(true); setError(null);
    try { const r = await productSocialApi.comment(productId, text, crypto.randomUUID(), media ?? undefined, replyingToId ?? undefined); setComments((c) => { const next = [r.data, ...c]; commentsCache.current = commentsCache.current ? { ...commentsCache.current, data: next, fetchedAt: Date.now() } : null; return next; }); setVisibleCount((n) => n + 1); setBody(""); setMedia(null); try { sessionStorage.removeItem(draftKey); } catch {} setReplyingTo(null); setReplyingToId(null); } catch { setError({ message: "Couldn't post your reply. Your draft is safe — try again.", kind: "action" }); } finally { setPosting(false); }
  };
  const toggleCommentLike = async (comment: ProductComment) => {
    if (!auth.user) return;
    const previous = { liked: comment.liked, likeCount: comment.likeCount };
    const optimistic = { ...comment, liked: !comment.liked, likeCount: Math.max(0, comment.likeCount + (comment.liked ? -1 : 1)) };
    setComments((items) => items.map((item) => item.id === comment.id ? optimistic : item));
    try {
      const result = await productSocialApi.commentLike(productId, comment.id, !comment.liked);
      setComments((items) => items.map((item) => item.id === comment.id ? { ...item, ...result.data } : item));
    } catch {
      setComments((items) => items.map((item) => item.id === comment.id ? { ...item, ...previous } : item));
      setError({ message: "Couldn't update that like. Try again.", kind: "action" });
    }
  };
  const removeComment = async (commentId: string) => {
    if (removing) return;
    setRemoving(commentId); setError(null);
    try { await productSocialApi.removeComment(productId, commentId); setComments((items) => { const next = items.filter((item) => item.id !== commentId); commentsCache.current = commentsCache.current ? { ...commentsCache.current, data: next, fetchedAt: Date.now() } : null; return next; }); setVisibleCount((n) => Math.max(0, n - 1)); } catch { setError({ message: "Couldn't delete that comment. Try again.", kind: "action" }); } finally { setRemoving(null); }
  };
  const loadMore = async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true); setError(null);
    try {
      const r = await productSocialApi.comments(productId, nextCursor, Boolean(auth.user));
      setComments((items) => { const next = [...items, ...r.data.filter((row) => !items.some((item) => item.id === row.id))]; commentsCache.current = { data: next, nextCursor: r.pagination.nextCursor, hasMore: r.pagination.hasMore, fetchedAt: Date.now() }; return next; });
      setNextCursor(r.pagination.nextCursor); setHasMore(r.pagination.hasMore);
    } catch { setError({ message: "Couldn't load more replies. Try again.", kind: "action" }); } finally { setLoadingMore(false); }
  };
  return <>
    <button ref={triggerRef} type="button" aria-label="View product comments" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <Icon name="message" size={20} />{visibleCount ? <small>{visibleCount}</small> : null}
    </button>
    {open && typeof document !== "undefined" ? createPortal(<div className="feed-comments-layer" role="dialog" aria-modal="true" aria-label="Comments">
      <button className="feed-comments-backdrop" type="button" aria-label="Close comments" onClick={() => setOpen(false)} />
      <section ref={sheetRef} className="feed-comments-sheet" aria-labelledby={`feed-comments-title-${productId}`}>
        <div className="feed-comments-handle" aria-hidden="true" onTouchStart={(e) => { dragStartY.current = e.touches[0]?.clientY ?? null; dragStartX.current = e.touches[0]?.clientX ?? null; if (sheetRef.current) sheetRef.current.style.setProperty("--sheet-drag", "0px"); }} onTouchMove={(e) => { const startY = dragStartY.current; const startX = dragStartX.current; const touch = e.touches[0]; if (startY == null || startX == null || !touch || !sheetRef.current) return; const dy = touch.clientY - startY; const dx = touch.clientX - startX; if (Math.abs(dx) > Math.abs(dy)) return; const delta = Math.max(0, dy); sheetRef.current.style.setProperty("--sheet-drag", `${Math.min(delta, 180)}px`); }} onTouchEnd={(e) => { const start = dragStartY.current; const y = e.changedTouches[0]?.clientY; const delta = start != null && y != null ? y - start : 0; dragStartY.current = null; dragStartX.current = null; if (sheetRef.current) sheetRef.current.style.removeProperty("--sheet-drag"); if (delta > 85) setOpen(false); }} onTouchCancel={() => { dragStartY.current = null; dragStartX.current = null; if (sheetRef.current) sheetRef.current.style.removeProperty("--sheet-drag"); }} /><header><button type="button" aria-label="Close comments" onClick={() => setOpen(false)}><Icon name="close" size={18} /></button><div><strong id={`feed-comments-title-${productId}`}>Comments</strong><small aria-live="polite">{visibleCount ? `${visibleCount} ${visibleCount === 1 ? "reply" : "replies"}` : "Join the conversation"}</small></div><span /></header>
        <div className="feed-comments-list">
          {error ? error.kind === "load" ? <button type="button" className="feed-comments-error" onClick={() => { setError(null); setOpen(false); window.setTimeout(() => setOpen(true), 0); }}>{error.message}</button> : <div className="feed-comments-error feed-comments-error-action" role="status"><span>{error.message}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss error">×</button></div> : null}
          {loading ? <p className="feed-comments-state">Loading…</p> : comments.length ? comments.map((comment) => <article key={comment.id}>
            <span className="feed-comment-avatar" aria-hidden="true"><ProfileAvatar userId={comment.userId} name={comment.user.name} alt="" /></span>
            <div><p><strong className="feed-comment-name">{comment.user.name}</strong><time dateTime={comment.createdAt}>{commentTime(comment.createdAt)}</time></p>{comment.parent ? <small className="feed-comment-reply-context">Replying to {comment.parent.user.name}</small> : null}{comment.body ? <div>{comment.body}</div> : null}{comment.mediaUrl ? <img className={`feed-comment-media${comment.mediaType === "gif" ? " is-gif" : ""}`} src={comment.mediaUrl} alt={comment.mediaType === "gif" ? "Comment GIF" : "Comment image"} loading="lazy" /> : null}<nav>{auth.user ? <button type="button" className={comment.liked ? "is-liked" : undefined} aria-pressed={comment.liked} onClick={() => void toggleCommentLike(comment)}>{comment.liked ? "Liked" : "Like"}{comment.likeCount ? ` ${comment.likeCount}` : ""}</button> : comment.likeCount ? <span>{comment.likeCount} likes</span> : null}<button type="button" onClick={() => { setReplyingTo(comment.user.name); setReplyingToId(comment.id); setBody((current) => { const mention = `@${comment.user.name} `; if (!current.trim()) return mention; if (current.startsWith(mention)) return current; return `${mention}${current}`; }); window.setTimeout(() => inputRef.current?.focus(), 0); }}>Reply</button>{auth.user?.id === comment.userId ? <button type="button" disabled={removing !== null} onClick={() => void removeComment(comment.id)}>{removing === comment.id ? "Deleting…" : "Delete"}</button> : null}</nav></div>
          </article>) : <p className="feed-comments-state">No comments yet. Be the first to reply.</p>}
          {hasMore ? <button className="feed-comments-more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Show more replies"}</button> : null}
        </div>
        {auth.user ? <form onSubmit={(e) => void submit(e)}><span className="feed-comment-avatar"><ProfileAvatar userId={auth.user.id} name={auth.user.name || "User"} alt="" /></span><div className="feed-comments-composer">{replyingTo ? <small>Replying to {replyingTo}<button type="button" onClick={() => { const mention = replyingTo ? `@${replyingTo} ` : ""; setReplyingTo(null); setReplyingToId(null); setBody((current) => mention && current.startsWith(mention) ? current.slice(mention.length) : current); }} aria-label="Cancel reply">×</button></small> : null}{media ? <div className="feed-comment-media-preview"><img src={media.url} alt={media.type === "gif" ? "GIF preview" : "Image preview"}/><button type="button" onClick={() => setMedia(null)} aria-label="Remove attachment">×</button></div> : null}<div className="feed-comment-media-actions"><button type="button" disabled={mediaBusy} onClick={() => photoInputRef.current?.click()}>Photo</button><button type="button" disabled={mediaBusy} onClick={() => gifInputRef.current?.click()}>GIF</button>{mediaBusy ? <small>Uploading…</small> : null}<input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const file=e.currentTarget.files?.[0]; e.currentTarget.value=""; void uploadCommentMedia(file); }}/><input ref={gifInputRef} type="file" accept="image/gif" hidden onChange={(e) => { const file=e.currentTarget.files?.[0]; e.currentTarget.value=""; void uploadCommentMedia(file); }}/></div><input ref={inputRef} value={body} onChange={(e) => setBody(e.target.value)} onFocus={() => window.setTimeout(() => inputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 180)} placeholder="Post your reply" maxLength={1000} enterKeyHint="send" inputMode="text" autoComplete="off" autoCorrect="on" spellCheck aria-label="Write a reply" aria-describedby={remainingChars <= 120 ? `comment-limit-${productId}` : undefined}/>{remainingChars <= 120 ? <span id={`comment-limit-${productId}`} className={`feed-comment-limit${remainingChars <= 30 ? " is-near" : ""}`} aria-live="polite">{remainingChars}</span> : null}</div><button type="submit" disabled={(!body.trim() && !media) || posting || mediaBusy}>{posting ? "…" : "Reply"}</button></form> : <HomeLink className="feed-comments-signin" href={`/login?next=${encodeURIComponent("/")}`}>Sign in to reply</HomeLink>}
      </section>
    </div>, document.body) : null}
  </>;
}

function productImage(p: Product) {
  return p.images[0]?.url ?? null;
}
function SectionHeading({
  title,
  eyebrow,
  href = "/explore",
}: {
  title: string;
  eyebrow?: string;
  href?: string;
}) {
  return (
    <div className="social-home-heading">
      <div>
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      <HomeLink href={href}>
        See all <Icon name="chevron" size={16} />
      </HomeLink>
    </div>
  );
}
function useProductActions(product: Product) {
  const auth = useAuth(),
    router = useRouter();
  const [error, setError] = useState(""),
    [following, setFollowing] = useState(false),
    [followBusy, setFollowBusy] = useState(false),
    [cartBusy, setCartBusy] = useState(false),
    [added, setAdded] = useState(false),
    [optionsOpen, setOptionsOpen] = useState(false),
    [notInterested, setNotInterested] = useState(false);
  useEffect(() => {
    let active = true;
    setFollowing(false);
    if (auth.isAuthenticated) {
      setFollowBusy(!followCache.loaded || followCache.account !== auth.user?.id);
      void ensureFollowCache(auth.user?.id).then(() => {
        if (active) {
          setFollowing(followCache.sellerIds.has(product.seller.userId));
          setFollowBusy(false);
        }
      });
    } else setFollowBusy(false);
    const updated = (event: Event) => {
      const detail = (
        event as CustomEvent<{ sellerId: string; following: boolean }>
      ).detail;
      if (detail?.sellerId === product.seller.userId)
        setFollowing(detail.following);
    };
    window.addEventListener("eazicart:follow-updated", updated);
    return () => {
      active = false;
      window.removeEventListener("eazicart:follow-updated", updated);
    };
  }, [auth.isAuthenticated, product.seller.userId]);
  const requireAuth = () => {
    if (auth.loading) return false;
    if (auth.isAuthenticated) return true;
    router.push("/login?next=/");
    return false;
  };
  const add = async () => {
    if (cartBusy || product.stock <= 0 || !requireAuth()) return;
    setError("");
    setCartBusy(true);
    try {
      await cartApi.add(product.id, 1);
      setAdded(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not add to cart",
      );
    } finally {
      setCartBusy(false);
    }
  };
  const follow = async () => {
    if (followBusy || !requireAuth()) return;
    setError("");
    setFollowBusy(true);
    try {
      if (following) await followsApi.unfollow(product.seller.userId);
      else await followsApi.follow(product.seller.userId);
      if (following) followCache.sellerIds.delete(product.seller.userId);
      else followCache.sellerIds.add(product.seller.userId);
      setFollowing(!following);
      window.dispatchEvent(
        new CustomEvent("eazicart:follow-updated", {
          detail: { sellerId: product.seller.userId, following: !following },
        }),
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update follow",
      );
    } finally {
      setFollowBusy(false);
    }
  };
  const markNotInterested = async () => {
    if (!requireAuth()) return;
    setOptionsOpen(false);
    try {
      await productsApi.feedEvent(product.id, "NOT_INTERESTED");
      setNotInterested(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update your feed");
    }
  };
  const share = async () => {
    const url = `${window.location.origin}/product/${product.id}`;
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else await navigator.clipboard.writeText(url);
      if (auth.isAuthenticated) void productsApi.feedEvent(product.id, "SHARE").catch(() => undefined);
    } catch {
      /* Share cancellation does not change product state or recommendation signals. */
    }
  };
  return { error, following, followBusy, cartBusy, added, optionsOpen, notInterested, setOptionsOpen, markNotInterested, add, follow, share };
}
function SocialProductPost({
  product,
  saved,
  busy,
  onToggleSaved,
}: {
  product: Product;
  saved: boolean;
  busy: boolean;
  onToggleSaved: (p: Product) => void;
}) {
  const image = productImage(product),
    a = useProductActions(product);
  const social = useProductSocial(product.id, product.social),
    liked = social.data?.liked ?? false;
  if (a.notInterested) return null;
  return (
    <FeedSignal productId={product.id}>
    <article className="social-product-post" data-figma-node="3250:20778">
      <header className="social-product-header">
        <HomeLink
          href={`/seller/${product.seller.id}`}
          className="social-product-identity"
        >
          <span>
            <ProfileAvatar
              userId={product.seller.userId}
              name={product.seller.displayName}
            />
          </span>
          <div>
            <strong>{product.seller.displayName}</strong>
            <small>
              {product.category.name}
              {product.seller.location?.label
                ? ` · ${product.seller.location.label}`
                : ""}
              {product.rating ? ` · ${product.rating} ★` : ""}
            </small>
          </div>
        </HomeLink>
        <div className="social-product-header-actions">
          <button
            type="button"
            className={a.following ? "is-following" : ""}
            disabled={a.followBusy}
            onClick={() => void a.follow()}
          >
            {a.followBusy ? "…" : a.following ? "Following" : "Follow"}
          </button>
          <span className="social-feed-options">
            <button type="button" aria-label="More options" aria-expanded={a.optionsOpen} onClick={() => a.setOptionsOpen(!a.optionsOpen)}>
              <Icon name="more" size={18} />
            </button>
            {a.optionsOpen ? <span className="social-feed-options-menu"><button type="button" onClick={() => void a.markNotInterested()}>Not interested</button></span> : null}
          </span>
        </div>
      </header>
      <p className="social-product-caption">
        {product.reel?.caption ?? product.description ?? product.name}
      </p>
      <div className="social-product-media">
        {image ? (
          <HomeLink href={`/product/${product.id}`}>
            <ContentImage
              src={image}
              alt={product.name}
              width={398}
              height={398}
              sizes="(max-width: 520px) 100vw, 398px"
              loading="eager"
              fetchPriority="high"
              priority
            />
          </HomeLink>
        ) : null}
        <span className="social-product-pagination">
          1 / {Math.max(product.imageCount ?? product.images.length, 1)}
        </span>
        <div className="social-product-chip">
          <HomeLink href={`/product/${product.id}`}>
            <span>
              {image ? (
                <ContentImage src={image} alt="" width={48} height={48} sizes="48px" loading="lazy" decoding="async" />
              ) : null}
            </span>
            <span>
              <strong>{product.name}</strong>
              <b>{money(product.price)}</b>
            </span>
          </HomeLink>
          <button
            type="button"
            disabled={a.cartBusy || product.stock <= 0}
            aria-label={`Add ${product.name} to cart`}
            onClick={() => void a.add()}
          >
            <Icon name={a.added ? "check" : "bag"} size={18} />
          </button>
        </div>
      </div>
      <div className="social-product-actions">
        <div>
          <button
            type="button"
            className={liked ? "is-active" : ""}
            aria-pressed={liked}
            aria-label={liked ? "Unlike product" : "Like product"}
            disabled={social.loading || social.busy}
            onClick={() => void social.toggleLike()}
          >
            <Icon name="heart" size={20} active={liked} />
            <small>
              {social.data?.likes ? String(social.data.likes) : "Like"}
            </small>
          </button>
          <FeedCommentsButton productId={product.id} count={social.data?.comments} />
          <button
            type="button"
            aria-label="Share product"
            onClick={() => void a.share()}
          >
            <Icon name="share" size={20} />
          </button>
        </div>
        <button
          type="button"
          className={saved ? "is-active" : ""}
          aria-label={saved ? "Remove from saved" : "Save product"}
          aria-pressed={saved}
          disabled={busy}
          onClick={() => onToggleSaved(product)}
        >
          <Icon name="bookmark" size={20} active={saved} />
        </button>
      </div>
      {a.error || social.error ? (
        <p className="social-home-action-error" role="alert">
          {a.error || social.error}
        </p>
      ) : null}
    </article>
    </FeedSignal>
  );
}
function HomeReelVideo({ reel }: { reel: Reel }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState(false);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let active = true;
    const playVisible = async () => {
      if (!active || document.hidden) return;
      // Prefer sound. iOS/Safari can reject audible autoplay by browser policy;
      // in that case keep the Reel moving and enable sound on the first gesture.
      element.muted = false;
      setMuted(false);
      try { await element.play(); }
      catch {
        element.muted = true;
        setMuted(true);
        try { await element.play(); } catch { /* user gesture can start it */ }
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.55) void playVisible();
        else element.pause();
      },
      { threshold: [0, 0.55, 0.85] },
    );
    observer.observe(element);
    const visibility = () => { if (document.hidden) element.pause(); else void playVisible(); };
    const unlockSound = () => {
      if (!active || !element.muted) return;
      element.muted = false;
      setMuted(false);
      setSoundUnlocked(true);
      void element.play().catch(() => { element.muted = true; setMuted(true); });
    };
    document.addEventListener("visibilitychange", visibility);
    // Once the user interacts with the feed, use that gesture to unlock audio
    // for the visible Reel on browsers that block audible autoplay.
    document.addEventListener("pointerdown", unlockSound, { once: true, passive: true });
    document.addEventListener("touchstart", unlockSound, { once: true, passive: true });
    return () => {
      active = false; observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerdown", unlockSound);
      document.removeEventListener("touchstart", unlockSound);
      element.pause();
    };
  }, []);
  const toggle = async () => {
    const element = video.current;
    if (!element) return;
    if (element.muted) {
      element.muted = false;
      setMuted(false);
      setSoundUnlocked(true);
      try { await element.play(); } catch { setError(true); }
      return;
    }
    if (!element.paused) element.pause();
    else { try { await element.play(); } catch { setError(true); } }
  };
  return (
    <div className="social-reel-media">
      <video
        ref={video}
        src={reel.videoUrl ?? undefined}
        poster={reel.thumbnailUrl ?? reel.product?.images[0]?.url ?? undefined}
        preload="metadata"
        autoPlay
        loop
        playsInline
        onClick={() => void toggle()}
        onPlay={() => { setPlaying(true); setError(false); }}
        onPause={() => setPlaying(false)}
        onVolumeChange={(event) => {
          setMuted(event.currentTarget.muted);
          if (!event.currentTarget.muted) setSoundUnlocked(true);
        }}
        onError={() => { setPlaying(false); setError(true); }}
      />
      {muted ? <button type="button" className="social-reel-unmute" onClick={() => void toggle()} aria-label="Turn Reel sound on"><Icon name="volume" size={16} /> Sound on</button> : soundUnlocked ? <span className="social-reel-sound-live" aria-label="Reel sound is on"><Icon name="volume" size={15} /></span> : null}
      {!playing && !error ? <button type="button" className="social-reel-play" onClick={() => void toggle()} aria-label="Play Reel"><Icon name="play" size={28} /></button> : null}
      {error ? <span className="social-reel-video-error" role="status">Video unavailable</span> : null}
    </div>
  );
}
function ShoppableReel({
  product,
  reel,
  saved,
  busy,
  onToggleSaved,
}: {
  product: Product;
  reel: Reel;
  saved: boolean;
  busy: boolean;
  onToggleSaved: (p: Product) => void;
}) {
  const image = productImage(product),
    a = useProductActions(product);
  const social = useProductSocial(product.id, product.social),
    liked = social.data?.liked ?? false;
  if (a.notInterested) return null;
  const reelHref = `/reels?reel=${encodeURIComponent(reel.id)}`;
  return (
    <FeedSignal productId={product.id}>
    <article className="social-shoppable-reel" data-figma-node="3250:20945">
      <header className="social-reel-header">
        <HomeLink href={`/seller/${product.seller.id}`}>
          <div>
            <strong>{product.seller.displayName}</strong>
            <small>
              {product.category.name}
              {product.seller.location?.label
                ? ` · ${product.seller.location.label}`
                : ""}
            </small>
          </div>
        </HomeLink>
        <span className="social-feed-options">
          <button type="button" aria-label="More options" aria-expanded={a.optionsOpen} onClick={() => a.setOptionsOpen(!a.optionsOpen)}>
            <Icon name="more" size={18} />
          </button>
          {a.optionsOpen ? <span className="social-feed-options-menu"><button type="button" onClick={() => void a.markNotInterested()}>Not interested</button></span> : null}
        </span>
      </header>
      <div className="social-reel-meta">
        <p className="social-reel-copy">{reel.caption ?? product.description ?? product.name}</p>
        <HomeLink href={reelHref}>Open Reel</HomeLink>
      </div>
      <div className="social-reel-preview">
        <HomeReelVideo key={reel.id} reel={reel} />
        <div className="social-reel-product">
          <HomeLink href={`/product/${product.id}`}>
            <span>
              {image ? (
                <ContentImage src={image} alt="" width={48} height={48} sizes="48px" loading="lazy" decoding="async" />
              ) : null}
            </span>
            <span>
              <strong>{product.name}</strong>
              <b>{money(product.price)}</b>
            </span>
          </HomeLink>
          <button
            type="button"
            aria-label={`Add ${product.name} to cart`}
            onClick={() => void a.add()}
            disabled={a.cartBusy || product.stock <= 0}
          >
            <Icon name={a.added ? "check" : "bag"} size={18} />
          </button>
        </div>
        <div className="social-reel-rail">
          <div className="social-reel-creator">
            <HomeLink href={`/seller/${product.seller.id}`}>
              <ProfileAvatar
                userId={product.seller.userId}
                name={product.seller.displayName}
              />
            </HomeLink>
            {!a.following ? (
              <button
                type="button"
                aria-label={`Follow ${product.seller.displayName}`}
                disabled={a.followBusy}
                onClick={() => void a.follow()}
              >
                <Icon name="plus" size={12} />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className={liked ? "is-active" : ""}
            aria-pressed={liked}
            aria-label={liked ? "Unlike product" : "Like product"}
            disabled={social.loading || social.busy}
            onClick={() => void social.toggleLike()}
          >
            <Icon name="heart" size={20} active={liked} />
            <small>
              {social.data?.likes ? String(social.data.likes) : "Like"}
            </small>
          </button>
          <FeedCommentsButton productId={product.id} count={social.data?.comments} />
          <button
            type="button"
            aria-label={saved ? "Remove from saved" : "Save product"}
            aria-pressed={saved}
            className={saved ? "is-active" : ""}
            disabled={busy}
            onClick={() => onToggleSaved(product)}
          >
            <Icon name="bookmark" size={20} active={saved} />
          </button>
          <button
            type="button"
            aria-label="Share product"
            onClick={() => void a.share()}
          >
            <Icon name="share" size={20} />
          </button>
          <button
            type="button"
            className="social-reel-cart"
            aria-label={`Add ${product.name} to cart`}
            disabled={a.cartBusy || product.stock <= 0}
            onClick={() => void a.add()}
          >
            <Icon name={a.added ? "check" : "bag"} size={20} />
          </button>
        </div>
      </div>
      {a.error || social.error ? (
        <p className="social-home-action-error" role="alert">
          {a.error || social.error}
        </p>
      ) : null}
    </article>
    </FeedSignal>
  );
}
function PriceDropPost({
  product,
  saved,
  busy,
  onToggleSaved,
}: {
  product: Product;
  saved: boolean;
  busy: boolean;
  onToggleSaved: (p: Product) => void;
}) {
  const image = productImage(product),
    a = useProductActions(product);
  const social = useProductSocial(product.id, product.social),
    liked = social.data?.liked ?? false;
  if (a.notInterested) return null;
  return (
    <article className="social-price-drop" data-figma-node="3250:20836">
      <header className="social-price-header">
        <HomeLink
          href={`/seller/${product.seller.id}`}
          className="social-price-identity"
        >
          <span>
            <ProfileAvatar
              userId={product.seller.userId}
              name={product.seller.displayName}
            />
          </span>
          <div>
            <strong>{product.seller.displayName}</strong>
            <small>
              {product.category.name}
              {product.seller.location?.label
                ? ` · ${product.seller.location.label}`
                : ""}
              {product.rating ? ` · ${product.rating} ★` : ""}
            </small>
          </div>
        </HomeLink>
        <div className="social-price-header-actions">
          <button
            type="button"
            className={a.following ? "is-following" : ""}
            disabled={a.followBusy}
            onClick={() => void a.follow()}
          >
            {a.followBusy ? "…" : a.following ? "Following" : "Follow"}
          </button>
          <span className="social-feed-options">
            <button type="button" aria-label="More options" aria-expanded={a.optionsOpen} onClick={() => a.setOptionsOpen(!a.optionsOpen)}>
              <Icon name="more" size={18} />
            </button>
            {a.optionsOpen ? <span className="social-feed-options-menu"><button type="button" onClick={() => void a.markNotInterested()}>Not interested</button></span> : null}
          </span>
        </div>
      </header>
      <span className="social-price-drop-label">Featured product</span>
      <div className="social-price-media">
        {image ? (
          <HomeLink href={`/product/${product.id}`}>
            <ContentImage
              src={image}
              alt={product.name}
              width={398}
              height={310}
              sizes="(max-width: 520px) 100vw, 398px"
              loading="lazy"
              decoding="async"
            />
          </HomeLink>
        ) : null}
        <div className="social-price-product">
          <HomeLink href={`/product/${product.id}`}>
            <span>
              {image ? (
                <ContentImage src={image} alt="" width={48} height={48} sizes="48px" loading="lazy" decoding="async" />
              ) : null}
            </span>
            <span>
              <strong>{product.name}</strong>
              <b>{money(product.price)}</b>
            </span>
          </HomeLink>
          <button
            type="button"
            aria-label={`Add ${product.name} to cart`}
            disabled={a.cartBusy || product.stock <= 0}
            onClick={() => void a.add()}
          >
            <Icon name={a.added ? "check" : "bag"} size={18} />
          </button>
        </div>
      </div>
      <div className="social-price-stack">
        <strong>{money(product.price)}</strong>
      </div>
      <div className="social-price-actions">
        <div>
          <button
            type="button"
            className={liked ? "is-active" : ""}
            aria-pressed={liked}
            aria-label={liked ? "Unlike product" : "Like product"}
            disabled={social.loading || social.busy}
            onClick={() => void social.toggleLike()}
          >
            <Icon name="heart" size={20} active={liked} />
            <small>
              {social.data?.likes ? String(social.data.likes) : "Like"}
            </small>
          </button>
          <FeedCommentsButton productId={product.id} count={social.data?.comments} />
          <button
            type="button"
            aria-label="Share product"
            onClick={() => void a.share()}
          >
            <Icon name="share" size={20} />
          </button>
        </div>
        <button
          type="button"
          aria-label={saved ? "Remove from saved" : "Save product"}
          aria-pressed={saved}
          className={saved ? "is-active" : ""}
          disabled={busy}
          onClick={() => onToggleSaved(product)}
        >
          <Icon name="bookmark" size={20} active={saved} />
        </button>
      </div>
      {a.error || social.error ? (
        <p className="social-home-action-error" role="alert">
          {a.error || social.error}
        </p>
      ) : null}
    </article>
  );
}
function FreshPicksGrid({ products }: { products: Product[] }) {
  const auth = useAuth(),
    router = useRouter();
  const [busy, setBusy] = useState<string | null>(null),
    [added, setAdded] = useState<Record<string, boolean>>({}),
    [error, setError] = useState("");
  const picks = products.slice(0, 4);
  if (!picks.length) return null;
  const add = async (p: Product) => {
    if (busy || p.stock <= 0) return;
    if (!auth.isAuthenticated) {
      router.push("/login?next=/");
      return;
    }
    setError("");
    setBusy(p.id);
    try {
      await cartApi.add(p.id, 1);
      setAdded((v) => ({ ...v, [p.id]: true }));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not add to cart",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="social-home-fresh" data-figma-node="3250:20896">
      <div className="social-home-fresh-heading">
        <div>
          <h2>Fresh Picks</h2>
          <p>Discover products from the catalog</p>
        </div>
        <HomeLink href="/explore">See all</HomeLink>
      </div>
      <div className="social-home-fresh-grid">
        {picks.map((p) => {
          const image = productImage(p);
          return (
            <article className="social-home-fresh-card" key={p.id}>
              <HomeLink
                className="social-home-fresh-image"
                href={`/product/${p.id}`}
              >
                {image ? (
                  <ContentImage
                    src={image}
                    alt={p.name}
                    width={191}
                    height={128}
                    sizes="(max-width: 520px) calc((100vw - 28px) / 2), 191px"
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </HomeLink>
              <HomeLink
                className="social-home-fresh-seller"
                href={`/seller/${p.seller.id}`}
              >
                {p.seller.displayName}
              </HomeLink>
              <HomeLink
                className="social-home-fresh-title"
                href={`/product/${p.id}`}
              >
                {p.name}
              </HomeLink>
              <strong>{money(p.price)}</strong>
              <button
                type="button"
                className="social-home-fresh-add"
                disabled={busy !== null || p.stock <= 0}
                onClick={() => void add(p)}
              >
                <Icon name={added[p.id] ? "check" : "bag"} size={16} />
                <span>{added[p.id] ? "Added" : "Add"}</span>
              </button>
            </article>
          );
        })}
      </div>
      {error ? (
        <p className="social-home-action-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
function ProductRail({
  products,
  isSaved,
  onToggleSaved,
}: {
  products: Product[];
  isSaved: (id: string) => boolean;
  onToggleSaved: (p: Product) => void;
}) {
  return (
    <section className="social-home-section">
      <SectionHeading
        title="Easy picks for your budget"
        eyebrow="Simple, useful finds"
      />
      <div className="social-home-product-rail">
        {products.slice(0, 4).map((p) => (
          <article className="social-home-product-card" key={p.id}>
            <HomeLink
              className="social-home-product-media"
              href={`/product/${p.id}`}
            >
              {productImage(p) ? (
                <ContentImage
                  src={productImage(p)!}
                  alt={p.name}
                  width={166}
                  height={190}
                  sizes="166px"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
            </HomeLink>
            <button
              type="button"
              aria-label={`Save ${p.name}`}
              className="social-home-save"
              onClick={() => onToggleSaved(p)}
            >
              <Icon name="heart" size={20} active={isSaved(p.id)} />
            </button>
            <HomeLink
              className="social-home-product-name"
              href={`/product/${p.id}`}
            >
              {p.name}
            </HomeLink>
            <strong>{money(p.price)}</strong>
            <small>{p.seller.displayName}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
function SellerRail({ products }: { products: Product[] }) {
  const sellers = Array.from(
    new Map(products.map((p) => [p.seller.id, p.seller])).values(),
  ).slice(0, 4);
  return (
    <section className="social-home-section">
      <SectionHeading title="Shops to explore" />
      <div className="social-home-seller-list">
        {sellers.map((s) => (
          <HomeLink
            href={`/seller/${s.id}`}
            className="social-home-seller"
            key={s.id}
          >
            <span>
              <ProfileAvatar userId={s.userId} name={s.displayName} />
            </span>
            <div>
              <strong>{s.displayName}</strong>
              <small>{s.bio || "View seller"}</small>
            </div>
            <b>
              View store <Icon name="chevron" size={16} />
            </b>
          </HomeLink>
        ))}
      </div>
    </section>
  );
}
export function HomeSocialFeed({
  products,
  isSaved,
  busy,
  onToggleSaved,
}: {
  products: Product[];
  isSaved: (id: string) => boolean;
  busy: string | null;
  onToggleSaved: (p: Product) => void;
}) {
  const auth = useAuth();
  const [publishedReels, setPublishedReels] = useState<Reel[]>([]);
  const [loadReels, setLoadReels] = useState(false);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [reelsLoadFailed, setReelsLoadFailed] = useState(false);
  const [reelsRequestAttempt, setReelsRequestAttempt] = useState(0);
  const reelLoadSentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const start = () => { if (!cancelled) setLoadReels(true); };
    const node = reelLoadSentinel.current;
    if (node && "IntersectionObserver" in window) {
      const isSafari = /Safari\//.test(navigator.userAgent) && !/Chrome\/|CriOS\/|FxiOS\//.test(navigator.userAgent);
      const observer = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) { start(); observer.disconnect(); }
      }, { rootMargin: isSafari ? "0px" : "350px 0px" });
      observer.observe(node);
      // Safari is more sensitive to parallel media work during startup. Wait
      // until the Reels sentinel actually enters the viewport there; other
      // browsers can keep the small proximity preload.
      return () => { cancelled = true; observer.disconnect(); };
    }
    // Very old browsers without IntersectionObserver still get Reels, but keep
    // that secondary request well behind first paint.
    const id = window.setTimeout(start, 5000);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, []);
  useEffect(() => {
    let active = true;
    if (!loadReels) return () => { active = false; };
    if (auth.loading) {
      setReelsLoading(false);
      return () => { active = false; };
    }
    setReelsLoading(true);
    setReelsLoadFailed(false);
    void reelsApi
      .feed({ source: "EAZICART", limit: 8, authenticated: auth.isAuthenticated })
      .then((result) => {
        if (active) {
          setPublishedReels(result.data);
          setReelsLoadFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setPublishedReels([]);
          setReelsLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setReelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadReels, reelsRequestAttempt, auth.loading, auth.isAuthenticated]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const shoppableReels = publishedReels.flatMap((item) => {
    if (!item.videoUrl || !item.product || item.product.active === false) return [];
    // A linked Reel must be able to appear even when its product is not in the
    // current FYP product page. Prefer the canonical feed product when present,
    // otherwise use the complete product returned with the published Reel.
    const product = productById.get(item.product.id) ?? item.product;
    return [{ reel: item, product }];
  });
  const reelProduct = shoppableReels[0]?.product;
  const first = products[0];
  const post = first
    ? products.find((p) => p.id !== reelProduct?.id) ?? first
    : undefined;
  const deal = post
    ? products.find((p) => p.id !== reelProduct?.id && p.id !== post.id) ?? post
    : undefined;
  const fresh = post && deal
    ? products
        .filter(
          (p) => p.id !== reelProduct?.id && p.id !== post.id && p.id !== deal.id,
        )
        .slice(0, 4)
    : [];
  return (
    <div className="social-home-feed">
      {post ? (
        <SocialProductPost
          product={post}
          saved={isSaved(post.id)}
          busy={busy === post.id}
          onToggleSaved={onToggleSaved}
        />
      ) : null}
      {deal ? (
        <PriceDropPost
          product={deal}
          saved={isSaved(deal.id)}
          busy={busy === deal.id}
          onToggleSaved={onToggleSaved}
        />
      ) : null}
      <div ref={reelLoadSentinel} data-testid="social-home-reels-sentinel" aria-hidden="true" style={{ height: 1 }} />
      {reelsLoading && shoppableReels.length === 0 ? (
        <p className="social-home-reels-status" role="status">Loading videos…</p>
      ) : null}
      {reelsLoadFailed && shoppableReels.length === 0 ? (
        <div className="social-home-reels-error" role="alert">
          <p>Videos couldn’t load. Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => {
              setReelsLoadFailed(false);
              setReelsRequestAttempt((attempt) => attempt + 1);
            }}
          >
            Retry videos
          </button>
        </div>
      ) : null}
      {shoppableReels.map(({ reel, product }) => (
        <ShoppableReel
          key={reel.id}
          reel={reel}
          product={product}
          saved={isSaved(product.id)}
          busy={busy === product.id}
          onToggleSaved={onToggleSaved}
        />
      ))}
      {first ? (
        <>
          <FreshPicksGrid products={fresh.length ? fresh : products} />
          <ProductRail
            products={products}
            isSaved={isSaved}
            onToggleSaved={onToggleSaved}
          />
          <SellerRail products={products} />
        </>
      ) : null}
      <HomeLink className="social-home-reels-cta" href="/reels">
        <span>
          <Icon name="play" size={20} />
        </span>
        <div>
          <small>Keep discovering</small>
          <strong>Watch products in action</strong>
        </div>
        <b>
          <Icon name="chevron" size={18} />
        </b>
      </HomeLink>
    </div>
  );
}