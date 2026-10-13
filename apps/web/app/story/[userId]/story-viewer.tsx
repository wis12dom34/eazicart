/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { cartApi } from "../../../lib/api/cart";
import { money } from "../../data";
import { useAuth } from "../../providers/auth-provider";

type StoryItem = {
  url: string;
  uploadedAt: string;
  isVideo: boolean;
};

type StoryProduct = {
  id: string;
  name: string;
  price: string;
  stock: number;
  imageUrl?: string;
  sellerId: string;
};

type Props = {
  stories: StoryItem[];
  sellerName: string;
  initials: string;
  profileUrl?: string;
  verified: boolean;
  product?: StoryProduct;
};

const IMAGE_DURATION_MS = 5500;

function relativeTime(value: string) {
  const then = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function StoryViewer({
  stories,
  sellerName,
  initials,
  profileUrl,
  verified,
  product,
}: Props) {
  const router = useRouter();
  const auth = useAuth();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const elapsedRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0, at: 0 });

  const active = stories[index];

  const close = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);

  const previous = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  const next = useCallback(() => {
    setIndex((current) => {
      if (current < stories.length - 1) return current + 1;
      window.setTimeout(close, 0);
      return current;
    });
  }, [close, stories.length]);

  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    setPaused(false);
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
      else frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, next, paused]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active?.isVideo) return;
    if (paused) video.pause();
    else void video.play().catch(() => undefined);
  }, [active, paused]);

  if (!active) return null;

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    pointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
    };
    setPaused(true);
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = pointerRef.current;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const heldFor = performance.now() - start.at;
    setPaused(false);

    if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      if (dx > 0) previous();
      else next();
      return;
    }

    if (heldFor > 300 || Math.abs(dx) > 18 || Math.abs(dy) > 18) return;
    if (event.clientX < window.innerWidth * 0.34) previous();
    else next();
  };

  const addToCart = async () => {
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

  const stopStoryGesture = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return (
    <main
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setPaused(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        width: "100vw",
        height: "100dvh",
        minHeight: "100svh",
        overflow: "hidden",
        overscrollBehavior: "none",
        touchAction: "none",
        userSelect: "none",
        background: "#000",
        color: "#fff",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, sans-serif',
      }}
    >
      {active.isVideo ? (
        <video
          key={active.url}
          ref={videoRef}
          src={active.url}
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-label={`${sellerName} story video`}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            if (!Number.isFinite(video.duration) || video.duration <= 0) return;
            setProgress(Math.min(video.currentTime / video.duration, 1));
          }}
          onEnded={next}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "cover",
            objectPosition: "center",
            background: "#000",
          }}
        />
      ) : (
        <img
          key={active.url}
          src={active.url}
          alt={`${sellerName} story`}
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "cover",
            objectPosition: "center",
            background: "#000",
          }}
        />
      )}

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(0,0,0,.56) 0%, rgba(0,0,0,.16) 18%, rgba(0,0,0,0) 45%, rgba(0,0,0,.08) 62%, rgba(0,0,0,.74) 100%)",
        }}
      />

      <div
        aria-label={`${index + 1} of ${stories.length} stories`}
        style={{
          position: "absolute",
          zIndex: 4,
          top: "calc(env(safe-area-inset-top, 0px) + 8px)",
          left: 10,
          right: 10,
          display: "flex",
          gap: 4,
          height: 3,
        }}
      >
        {stories.map((story, storyIndex) => {
          const width =
            storyIndex < index
              ? 100
              : storyIndex > index
                ? 0
                : progress * 100;
          return (
            <span
              key={`${story.url}-${storyIndex}`}
              style={{
                flex: 1,
                height: 3,
                overflow: "hidden",
                borderRadius: 999,
                background: "rgba(255,255,255,.38)",
              }}
            >
              <span
                style={{
                  display: "block",
                  width: `${width}%`,
                  height: "100%",
                  borderRadius: "inherit",
                  background: "#fff",
                }}
              />
            </span>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          zIndex: 4,
          top: "calc(env(safe-area-inset-top, 0px) + 22px)",
          left: 14,
          right: 66,
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
          textShadow: "0 1px 6px rgba(0,0,0,.45)",
        }}
      >
        <Link
          href={product ? `/seller/${product.sellerId}` : "/"}
          onPointerDown={stopStoryGesture}
          onPointerUp={stopStoryGesture}
          aria-label={`View ${sellerName}`}
          style={{
            width: 44,
            height: 44,
            flex: "0 0 44px",
            padding: 2,
            borderRadius: "50%",
            background: "rgba(255,255,255,.96)",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "#151515",
              color: "#fff",
              fontSize: 13,
              fontWeight: 750,
            }}
          >
            {profileUrl ? (
              <img
                src={profileUrl}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              initials
            )}
          </span>
        </Link>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <strong
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "#fff",
                fontSize: 15,
                lineHeight: "18px",
                fontWeight: 700,
                letterSpacing: "-0.15px",
              }}
            >
              {sellerName}
            </strong>
            {verified ? (
              <span
                aria-label="Verified seller"
                title="Verified seller"
                style={{
                  width: 16,
                  height: 16,
                  flex: "0 0 16px",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  background: "#1d9bf0",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 900,
                  lineHeight: 1,
                  textShadow: "none",
                }}
              >
                ✓
              </span>
            ) : null}
          </div>
          <span
            style={{
              display: "block",
              marginTop: 2,
              color: "rgba(255,255,255,.72)",
              fontSize: 12,
              lineHeight: "15px",
              fontWeight: 500,
            }}
          >
            {relativeTime(active.uploadedAt)}
          </span>
        </div>
      </div>

      <button
        type="button"
        aria-label="Close story"
        onPointerDown={stopStoryGesture}
        onPointerUp={stopStoryGesture}
        onClick={close}
        style={{
          position: "absolute",
          zIndex: 5,
          top: "calc(env(safe-area-inset-top, 0px) + 22px)",
          right: 12,
          width: 42,
          height: 42,
          display: "grid",
          placeItems: "center",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: "50%",
          background: "rgba(15,15,15,.58)",
          WebkitBackdropFilter: "blur(18px)",
          backdropFilter: "blur(18px)",
          color: "#fff",
          padding: 0,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 6 18 18M18 6 6 18"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {paused ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            zIndex: 3,
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              width: 48,
              height: 48,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              background: "rgba(0,0,0,.34)",
              WebkitBackdropFilter: "blur(10px)",
              backdropFilter: "blur(10px)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6.5" y="5" width="4" height="14" rx="1" />
              <rect x="13.5" y="5" width="4" height="14" rx="1" />
            </svg>
          </span>
        </div>
      ) : null}

      {product ? (
        <section
          aria-label="Story product"
          onPointerDown={stopStoryGesture}
          onPointerUp={stopStoryGesture}
          style={{
            position: "absolute",
            zIndex: 5,
            left: 12,
            right: 12,
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
            padding: 10,
            border: "1px solid rgba(255,255,255,.16)",
            borderRadius: 20,
            background: "rgba(18,18,18,.66)",
            WebkitBackdropFilter: "blur(22px) saturate(145%)",
            backdropFilter: "blur(22px) saturate(145%)",
            boxShadow: "0 14px 40px rgba(0,0,0,.26)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 52,
                height: 52,
                flex: "0 0 52px",
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
                borderRadius: 14,
                background: "rgba(255,255,255,.1)",
                color: "#fff",
                fontSize: 17,
                fontWeight: 800,
              }}
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                product.name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#fff",
                  fontSize: 14,
                  lineHeight: "18px",
                  fontWeight: 700,
                  letterSpacing: "-0.12px",
                }}
              >
                {product.name}
              </strong>
              <span
                style={{
                  display: "block",
                  marginTop: 3,
                  color: "rgba(255,255,255,.76)",
                  fontSize: 13,
                  lineHeight: "16px",
                  fontWeight: 650,
                }}
              >
                {money(product.price)}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 9 }}>
            <Link
              href={`/product/${product.id}`}
              style={{
                minHeight: 44,
                display: "grid",
                placeItems: "center",
                borderRadius: 13,
                background: "rgba(255,255,255,.94)",
                color: "#111",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 750,
                letterSpacing: "-0.1px",
              }}
            >
              View product
            </Link>
            <button
              type="button"
              disabled={busy || added || product.stock < 1}
              onClick={() => void addToCart()}
              style={{
                minHeight: 44,
                border: 0,
                borderRadius: 13,
                background: product.stock < 1 ? "rgba(255,255,255,.16)" : "#ff6500",
                color: "#fff",
                font: "inherit",
                fontSize: 14,
                fontWeight: 750,
                letterSpacing: "-0.1px",
                opacity: busy ? 0.72 : 1,
              }}
            >
              {product.stock < 1
                ? "Out of stock"
                : busy
                  ? "Adding…"
                  : added
                    ? "Added ✓"
                    : "Add to cart"}
            </button>
          </div>
        </section>
      ) : (
        <div
          style={{
            position: "absolute",
            zIndex: 3,
            left: 20,
            right: 20,
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
            color: "rgba(255,255,255,.82)",
            fontSize: 14,
            lineHeight: "19px",
            fontWeight: 600,
            textShadow: "0 2px 10px rgba(0,0,0,.5)",
          }}
        >
          Seller story
        </div>
      )}
    </main>
  );
}
