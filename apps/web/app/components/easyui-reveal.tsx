"use client";

import type { ReactNode } from "react";
import "./easyui-reveal.css";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
};

/**
 * Progressive enhancement for product-discovery sections.
 * Content stays visible when motion is reduced or CSS is unavailable.
 */
export function EasyUIReveal({ children, className = "", delayMs = 0 }: RevealProps) {
  const delay = Math.max(0, Math.min(delayMs, 600));
  return (
    <div
      className={["easyui-reveal", className].filter(Boolean).join(" ")}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
