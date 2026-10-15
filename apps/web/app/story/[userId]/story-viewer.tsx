/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { ProfileAvatar } from "../../components/profile-avatar";
import { Icon } from "../../components/icon";
import { cartApi } from "../../../lib/api/cart";
import { useAuth } from "../../providers/auth-provider";
import styles from "./story-viewer.module.css";

type StoryItem = { url: string; uploadedAt: string; isVideo: boolean };
type StoryProduct = { id: string; name: string; price: string; stock: number; imageUrl?: string; sellerId: string };
type Props = { stories: StoryItem[]; sellerName: string; userId: string; sellerId?: string; verified: boolean; product?: StoryProduct };
const IMAGE_DURATION_MS = 5500;

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function StoryViewer({ stories, sellerName, userId, sellerId, verified, product }: Props) {
  const router = useRouter();
  const auth = useAuth();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewerRef = useRef<HTMLElement | null>(null);
  const elapsedRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0, at: 0 });
  const active = stories[index];
  const paused = holding || pageHidden;

  const close = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);
  const previous = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);
  const next = useCallback(() => setIndex((current) => {
    if (current < stories.length - 1) return current + 1;
    window.setTimeout(close, 0);
    return current;
  }), [close, stories.length]);

  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    setHolding(false);
    setAdded(false);
  }, [index]);

  useEffect(() => {
    if (!active || active.isVideo || paused) return;
    let frame = 0;
    const startedAt = performance.now() - elapsedRef.current;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      elapsedRef.current = elapsed;
      const ratio = Math.min(elapsed / IMAGE_DURATION_MS, 1);
      setProgress(ratio);
      if (ratio >= 1) next();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, next, paused]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active?.isVideo) return;
    if (paused) video.pause();
    else void video.play().catch(() => undefined);
  }, [active, paused]);

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.visibilityState !== "visible");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, next, previous]);

  if (!active) return null;

  const pointerDown = (event: PointerEvent<HTMLElement>) => {
    pointerRef.current = { x: event.clientX, y: event.clientY, at: performance.now() };
    setHolding(true);
  };
  const pointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = pointerRef.current;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const held = performance.now() - start.at;
    setHolding(false);
    if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      if (dx > 0) previous();
      else next();
      return;
    }
    if (held > 300 || Math.abs(dx) > 18 || Math.abs(dy) > 18) return;
    const bounds = viewerRef.current?.getBoundingClientRect();
    const midpoint = bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2;
    if (event.clientX < midpoint) previous();
    else next();
  };
  const stop = (event: PointerEvent<HTMLElement>) => event.stopPropagation();
  const add = async () => {
    if (!product || busy || product.stock < 1) return;
    if (!auth.isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    try {
      await cartApi.add(product.id, 1);
      setAdded(true);
    } finally {
      setBusy(false);
    }
  };
  const sellerHref = sellerId ? `/seller/${sellerId}` : product ? `/seller/${product.sellerId}` : "/";

  return <main ref={viewerRef} className={styles.viewer} data-figma-node="1265:15576" onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={() => setHolding(false)}>
    {active.isVideo ? <video className={styles.media} key={active.url} ref={videoRef} src={active.url} autoPlay muted playsInline preload="auto" aria-label={`${sellerName} story video`} onTimeUpdate={(event) => { const video = event.currentTarget; if (Number.isFinite(video.duration) && video.duration > 0) setProgress(Math.min(video.currentTime / video.duration, 1)); }} onEnded={next} /> : <img className={styles.media} key={active.url} src={active.url} alt={`${sellerName} story`} draggable={false} />}
    <div className={styles.shade} aria-hidden="true" />
    <div className={styles.progress} aria-label={`${index + 1} of ${stories.length} stories`}>{stories.map((story, storyIndex) => { const width = storyIndex < index ? 100 : storyIndex > index ? 0 : progress * 100; return <span className={styles.progressTrack} key={`${story.url}-${storyIndex}`}><span className={styles.progressFill} style={{ width: `${width}%` }} /></span>; })}</div>
    <div className={styles.header}>
      <Link className={styles.avatarLink} href={sellerHref} onPointerDown={stop} onPointerUp={stop} aria-label={`View ${sellerName}`}><span className={styles.avatarInner}><ProfileAvatar userId={userId} name={sellerName} /></span></Link>
      <div className={styles.identity}><div className={styles.nameRow}><strong className={styles.name}>{sellerName}</strong>{verified ? <span className={styles.verified} aria-label="Verified seller" title="Verified seller"><Icon name="check" size={9} weight="semibold" /></span> : null}</div><span className={styles.time}>{relativeTime(active.uploadedAt)}</span></div>
    </div>
    <button className={styles.close} type="button" aria-label="Close story" onPointerDown={stop} onPointerUp={stop} onClick={close}><Icon name="close" size={22} /></button>
    {paused ? <div className={styles.pause} aria-hidden="true"><span><Icon name="pause" size={20} filled /></span></div> : null}
    {product ? <><div className={styles.productCopy}><h2>{product.name}</h2><p>New arrivals · Just dropped</p></div><div className={styles.actions} onPointerDown={stop} onPointerUp={stop}><Link className={styles.action} href={`/product/${product.id}`}>View product</Link><button className={styles.cart} type="button" disabled={busy || added || product.stock < 1} onClick={() => void add()}>{product.stock < 1 ? "Out of stock" : busy ? "Adding…" : added ? "Added" : "Add to cart"}</button></div></> : <div className={styles.productCopy}><p>Seller story</p></div>}
  </main>;
}
