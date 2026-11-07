/* eslint-disable @next/next/no-img-element */
"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import type { PublicBadge } from "../../lib/api/types";
import { readBadge, subscribeBadge } from "./badge-store";
import styles from "./verified-badge.module.css";

// Preserve the user-supplied Pro SVG and existing Business export unchanged.
const assets: Record<PublicBadge["variant"], string> = {
  pro: "/figma/eazicart-pro-blue-badge.svg",
  business: "/figma/verified.svg",
};
export function VerifiedBadge({
  badge = null,
  accountId,
  size = "small",
}: {
  badge?: PublicBadge | null;
  accountId: string;
  size?: "small" | "medium" | "large";
}) {
  const subscribe = useCallback(
    (fn: () => void) => subscribeBadge(accountId, badge, fn),
    [accountId, badge],
  );
  const current = useSyncExternalStore(
    subscribe,
    () => readBadge(accountId, badge),
    () => badge,
  );
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const tooltip = useId();
  const tooltipRoot = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const show = () => {
    clearTimeout(closeTimer.current);
    const rect = root.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        left: Math.max(
          12,
          Math.min(window.innerWidth - 272, rect.left + rect.width / 2 - 130),
        ),
        top:
          rect.bottom + 110 < window.innerHeight
            ? rect.bottom + 8
            : Math.max(12, rect.top - 100),
      });
    setOpen(true);
  };
  const leave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !tooltipRoot.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    };
    const dismiss = () => setOpen(false);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);
  if (!current) return null;
  const plan = current.variant === "pro" ? "Pro" : "Business";
  const label = `Verified ${plan} — This account has an active EaziCart ${plan} subscription.`;
  return (
    <span
      ref={root}
      className={`${styles.root} ${styles[size]}`}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") show();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") leave();
      }}
    >
      <span
        role="button"
        tabIndex={0}
        className={styles.trigger}
        aria-label={label}
        aria-describedby={open ? tooltip : undefined}
        aria-expanded={open}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) show();
        }}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (open) setOpen(false);
          else show();
        }}
        onKeyDown={(event) => {
          if (["Enter", " "].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            if (open) setOpen(false);
            else show();
          }
        }}
      >
        <img
          src={assets[current.variant]}
          alt=""
          width={16}
          height={16}
          draggable={false}
        />
      </span>
      {open &&
        createPortal(
          <span
            ref={tooltipRoot}
            role="tooltip"
            id={tooltip}
            className={styles.tooltip}
            style={position}
            onPointerEnter={() => clearTimeout(closeTimer.current)}
            onPointerLeave={leave}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
