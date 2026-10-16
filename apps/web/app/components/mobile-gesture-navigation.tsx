"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const EDGE = 24;
const SLOP = 10;
const BACK_DISTANCE = 84;
const TAB_DISTANCE = 72;
const PULL_DISTANCE = 92;
const tabs = ["/", "/explore?section=trending", "/explore?section=categories", "/explore?section=nearby", "/following"];
const rootRoutes = new Set(["/", "/explore", "/reels", "/cart", "/chat"]);

function haptic(ms = 8) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
}

function isInteractive(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button,a,input,textarea,select,label,[role='button']"));
}

function isHorizontalSurface(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(".figma-home-story-strip,.social-home-product-rail,[data-horizontal-scroll],[data-gesture-gallery],input,textarea,select"));
}

function discoveryIndex(pathname: string, section: string | null) {
  if (pathname === "/") return 0;
  if (pathname === "/following") return 4;
  if (pathname === "/explore") {
    if (section === "trending") return 1;
    if (section === "categories") return 2;
    if (section === "nearby") return 3;
  }
  return -1;
}

export function MobileGestureNavigation({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const state = useRef({ id: -1, x: 0, y: 0, t: 0, mode: "" as "" | "back" | "tab" | "pull", locked: false, target: null as EventTarget | null });

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resetTransform = () => {
      const main = document.querySelector<HTMLElement>("body > div main, body main");
      if (!main) return;
      main.style.transition = reduced ? "none" : "transform 180ms cubic-bezier(.2,.8,.2,1)";
      main.style.transform = "";
      window.setTimeout(() => { main.style.transition = ""; }, 190);
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      const canBack = event.clientX <= EDGE && !rootRoutes.has(pathname) && window.history.length > 1;
      const canPull = window.scrollY <= 0 && !isInteractive(event.target);
      state.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: performance.now(), mode: canBack ? "back" : canPull ? "pull" : "", locked: false, target: event.target };
    };

    const onMove = (event: PointerEvent) => {
      const s = state.current;
      if (event.pointerId !== s.id) return;
      const dx = event.clientX - s.x;
      const dy = event.clientY - s.y;
      if (!s.locked && Math.hypot(dx, dy) >= SLOP) {
        s.locked = true;
        if (s.mode === "back") s.mode = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.25 ? "back" : "";
        else if (Math.abs(dx) > Math.abs(dy) * 1.25 && !isHorizontalSurface(s.target) && discoveryIndex(pathname, search.get("section")) >= 0) s.mode = "tab";
        else if (s.mode === "pull") s.mode = dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.35 ? "pull" : "";
      }
      if (s.mode === "back" && s.locked) {
        const main = document.querySelector<HTMLElement>("body main");
        if (main) {
          main.style.transition = "none";
          main.style.transform = `translate3d(${Math.max(0, Math.min(dx * .72, 132))}px,0,0)`;
        }
      }
      if (s.mode === "pull" && s.locked && dy > 0) document.documentElement.style.setProperty("--pull-progress", String(Math.min(dy / PULL_DISTANCE, 1)));
    };

    const onUp = (event: PointerEvent) => {
      const s = state.current;
      if (event.pointerId !== s.id) return;
      const dx = event.clientX - s.x;
      const dy = event.clientY - s.y;
      const dt = Math.max(1, performance.now() - s.t);
      const vx = dx / dt;
      if (s.mode === "back" && (dx >= BACK_DISTANCE || vx > .55)) {
        haptic();
        resetTransform();
        router.back();
      } else if (s.mode === "tab" && (Math.abs(dx) >= TAB_DISTANCE || Math.abs(vx) > .55)) {
        const index = discoveryIndex(pathname, search.get("section"));
        const next = Math.max(0, Math.min(tabs.length - 1, index + (dx < 0 ? 1 : -1)));
        if (next !== index) { haptic(6); router.push(tabs[next]!); }
      } else if (s.mode === "pull" && dy >= PULL_DISTANCE && window.scrollY <= 0) {
        haptic(8);
        window.dispatchEvent(new CustomEvent("eazicart:refresh", { detail: { pathname } }));
      }
      document.documentElement.style.removeProperty("--pull-progress");
      resetTransform();
      state.current.id = -1;
    };

    const onVisibility = () => {
      if (!document.hidden) return;
      document.querySelectorAll<HTMLVideoElement>("video").forEach(video => video.pause());
    };

    let lastTap = 0;
    let tapTimer = 0;
    const onReelTap = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || event.button !== 0 || isInteractive(event.target)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const reelPage = target.closest("main[data-figma-node='223:51']");
      if (!reelPage) return;
      const slide = target.closest("article");
      const video = slide?.querySelector<HTMLVideoElement>("video");
      if (!video) return;
      const now = performance.now();
      if (now - lastTap < 300) {
        window.clearTimeout(tapTimer);
        lastTap = 0;
        const like = slide?.querySelector<HTMLButtonElement>("button[aria-label='Like reel']");
        if (like && !like.disabled) { like.click(); haptic(10); slide?.classList.add("gesture-heart-pop"); window.setTimeout(() => slide?.classList.remove("gesture-heart-pop"), 520); }
        return;
      }
      lastTap = now;
      tapTimer = window.setTimeout(() => {
        if (video.paused) { void video.play().catch(() => undefined); slide?.classList.add("gesture-play-pop"); }
        else { video.pause(); slide?.classList.add("gesture-pause-pop"); }
        window.setTimeout(() => { slide?.classList.remove("gesture-play-pop", "gesture-pause-pop"); }, 420);
      }, 300);
    };

    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("pointerup", onReelTap, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerup", onReelTap, true);
      window.clearTimeout(tapTimer);
    };
  }, [pathname, router, search]);

  return <>{children}</>;
}
