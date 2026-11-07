"use client";
import { apiRequest } from "../../lib/api/client";
import type { PublicBadge } from "../../lib/api/types";

const members = new Map<
  string,
  { badge: PublicBadge | null; listeners: Set<() => void> }
>();
let timer: ReturnType<typeof setTimeout> | undefined;
let busy = false;
let nextRefreshAt = 0;
function notify() {
  members.forEach((m) => m.listeners.forEach((fn) => fn()));
}
function schedule() {
  clearTimeout(timer);
  if (!members.size) return;
  const now = Date.now();
  const ends = [...members.values()]
    .flatMap((m) => (m.badge ? [Date.parse(m.badge.expiresAt)] : []))
    .filter((n) => n > now);
  timer = setTimeout(
    () => {
      notify();
      if (Date.now() >= nextRefreshAt) void refresh();
      schedule();
    },
    Math.max(1, Math.min(nextRefreshAt - now, ...ends.map((n) => n - now))),
  );
}
async function refresh() {
  if (busy || !members.size) {
    nextRefreshAt = Date.now() + 30_000;
    return;
  }
  busy = true;
  nextRefreshAt = Date.now() + 30_000;
  schedule();
  try {
    const snapshot = new Map(members);
    const ids = [...snapshot.keys()];
    for (let i = 0; i < ids.length; i += 1000) {
      const result = await apiRequest<{
        data: Record<string, PublicBadge | null>;
      }>("/verification/badges", {
        method: "POST",
        body: { accountIds: ids.slice(i, i + 1000) },
      });
      ids.slice(i, i + 1000).forEach((id) => {
        const member = members.get(id);
        if (member && member === snapshot.get(id))
          member.badge = result.data[id] ?? null;
      });
    }
  } catch {
    // Fail closed if current server state cannot be refreshed.
    members.forEach((m) => {
      m.badge = null;
    });
  } finally {
    busy = false;
    notify();
    schedule();
  }
}
const focus = () => {
  notify();
  void refresh();
};
const visible = () => {
  if (document.visibilityState === "visible") focus();
};
export function subscribeBadge(
  id: string,
  initial: PublicBadge | null,
  listener: () => void,
) {
  if (!members.size) {
    nextRefreshAt = Date.now() + 30_000;
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
  }
  const member = members.get(id) ?? {
    badge: initial,
    listeners: new Set<() => void>(),
  };
  member.listeners.add(listener);
  members.set(id, member);
  schedule();
  return () => {
    member.listeners.delete(listener);
    if (!member.listeners.size) members.delete(id);
    if (!members.size) {
      clearTimeout(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
    }
  };
}
export function readBadge(id: string, initial: PublicBadge | null) {
  const badge = members.get(id)?.badge ?? (members.has(id) ? null : initial);
  return badge && Date.parse(badge.expiresAt) > Date.now() ? badge : null;
}
