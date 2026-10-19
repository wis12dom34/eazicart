import { upload } from "@vercel/blob/client";
import { tokenStore } from "./api/client";

const PROFILE_MAX_BYTES = 8 * 1024 * 1024;
const STORY_MAX_BYTES = 50 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const profilePhotoCache = new Map<string, Promise<SocialMediaItem | null>>();
const profilePhotoFetchedAt = new Map<string, number>();
const profilePhotoRequests = new Map<string, Promise<SocialMediaItem | null>>();
const PROFILE_PHOTO_TTL_MS = 30_000;

export const PROFILE_PHOTO_EVENT = "eazicart:profile-photo-updated";
export const PROFILE_PHOTO_STORAGE_KEY = "eazicart:profile-photo-refresh";
export type SocialMediaItem = { url: string; uploadedAt: string; contentType?: string };

function contentTypeFromName(value: string) {
  const pathname = value.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";
  if (/\.mp4$/.test(pathname)) return "video/mp4";
  if (/\.mov$/.test(pathname)) return "video/quicktime";
  if (/\.webm$/.test(pathname)) return "video/webm";
  if (/\.png$/.test(pathname)) return "image/png";
  if (/\.webp$/.test(pathname)) return "image/webp";
  if (/\.jpe?g$/.test(pathname)) return "image/jpeg";
  return undefined;
}
function safeFileName(file: File) {
  const cleaned = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (cleaned) return cleaned;
  if (file.type === "video/quicktime") return "story.mov";
  if (file.type === "video/mp4") return "story.mp4";
  if (file.type === "video/webm") return "story.webm";
  if (file.type === "image/png") return "photo.png";
  if (file.type === "image/webp") return "photo.webp";
  return "photo.jpg";
}
function validateMedia(kind: "profile" | "story", file: File) {
  const image = imageTypes.has(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
  const video = videoTypes.has(file.type) || /\.(mp4|mov|webm)$/i.test(file.name);
  if (kind === "profile" && !image) throw new Error("Choose a JPG, PNG or WebP profile photo.");
  if (kind === "story" && !image && !video) throw new Error("Choose a photo or video from your gallery.");
  const maxBytes = kind === "profile" ? PROFILE_MAX_BYTES : STORY_MAX_BYTES;
  if (file.size > maxBytes) throw new Error(kind === "profile" ? "Choose a profile photo smaller than 8 MB." : "Choose a story smaller than 50 MB.");
}
function broadcastProfilePhoto(userId: string, photo: SocialMediaItem | null) {
  profilePhotoCache.set(userId, Promise.resolve(photo));
  profilePhotoFetchedAt.set(userId, Date.now());
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_EVENT, { detail: { userId, photo } }));
  try { window.localStorage.setItem(PROFILE_PHOTO_STORAGE_KEY, JSON.stringify({ userId, at: Date.now() })); } catch { /* Storage can be unavailable in private browsing. */ }
}

export async function uploadSocialMedia(kind: "profile" | "story", userId: string, file: File, onProgress?: (percentage: number) => void) {
  validateMedia(kind, file);
  const accessToken = tokenStore.get()?.accessToken;
  if (!accessToken) throw new Error("Please sign in again before uploading media.");
  const folder = kind === "profile" ? "profiles" : "stories";
  const blob = await upload(`${folder}/${userId}/${Date.now()}-${safeFileName(file)}`, file, {
    access: "public", handleUploadUrl: "/api/social-images/upload", clientPayload: JSON.stringify({ accessToken }),
    contentType: file.type || undefined, multipart: file.size > 4 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => onProgress?.(percentage),
  });
  const item = { url: blob.url, uploadedAt: new Date().toISOString(), contentType: file.type || contentTypeFromName(file.name) };
  if (kind === "profile") broadcastProfilePhoto(userId, item);
  return item;
}

export async function removeProfilePhoto(userId: string) {
  const accessToken = tokenStore.get()?.accessToken;
  if (!accessToken) throw new Error("Please sign in again before removing your photo.");
  const response = await fetch("/api/social-images/profile", {
    method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, accessToken }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Could not remove profile photo");
  }
  broadcastProfilePhoto(userId, null);
}

export async function fetchProfilePhotos(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean))).slice(0, 50);
  if (!ids.length) return {} as Record<string, SocialMediaItem>;
  try {
    const payload = await apiRequest<{ data?: Record<string, SocialMediaItem> }>(
      "/social/profiles",
      { query: { userIds: ids.join(",") }, cache: "force-cache", timeoutMs: 10_000 },
    );
    const now = Date.now();
    const data = payload.data ?? {};
    for (const userId of ids) {
      const photo = data[userId] ?? null;
      profilePhotoCache.set(userId, Promise.resolve(photo));
      profilePhotoFetchedAt.set(userId, now);
    }
    return data;
  } catch {
    return {} as Record<string, SocialMediaItem>;
  }
}

export async function fetchProfilePhoto(userId: string) {
  const cached = profilePhotoCache.get(userId);
  if (cached && (profilePhotoRequests.has(userId) || Date.now() - (profilePhotoFetchedAt.get(userId) ?? 0) < PROFILE_PHOTO_TTL_MS)) return cached;
  const request: Promise<SocialMediaItem | null> = fetch(`/api/social-images/profile?userId=${encodeURIComponent(userId)}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) })
    .then(async (response) => {
      if (!response.ok) throw new Error("Could not load profile photo");
      const payload = (await response.json()) as { data?: SocialMediaItem | null };
      const current = profilePhotoCache.get(userId);
      if (current && current !== request) return current;
      if (profilePhotoRequests.get(userId) !== request) return null;
      return payload.data ?? null;
    })
    .catch(() => {
      const current = profilePhotoCache.get(userId);
      if (current && current !== request) return current;
      if (profilePhotoRequests.get(userId) !== request) return null;
      if (profilePhotoCache.get(userId) === request) {
        if (cached) profilePhotoCache.set(userId, cached); else profilePhotoCache.delete(userId);
        profilePhotoFetchedAt.delete(userId);
      }
      return cached ?? null;
    })
    .finally(() => {
      if (profilePhotoRequests.get(userId) === request) profilePhotoRequests.delete(userId);
    });
  profilePhotoCache.set(userId, request); profilePhotoFetchedAt.set(userId, Date.now()); profilePhotoRequests.set(userId, request);
  return request;
}
export function invalidateProfilePhoto(userId: string) {
  profilePhotoFetchedAt.delete(userId);
  // A read already in flight predates the cross-tab change. Start a fresh read
  // instead of reusing it, and prevent it from later restoring stale media.
  if (profilePhotoRequests.has(userId)) {
    profilePhotoCache.delete(userId);
    profilePhotoRequests.delete(userId);
  }
}
export async function fetchStories(userIds: string[]) {
  if (!userIds.length) return {} as Record<string, SocialMediaItem>;
  try {
    const response = await fetch(
      `/api/social-images/stories?userIds=${encodeURIComponent(userIds.join(","))}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) return {} as Record<string, SocialMediaItem>;
    const payload = (await response.json()) as { data?: Record<string, SocialMediaItem> };
    return Object.fromEntries(
      Object.entries(payload.data ?? {}).map(([userId, story]) => [userId, {
        ...story, contentType: story.contentType || contentTypeFromName(story.url),
      }]),
    ) as Record<string, SocialMediaItem>;
  } catch {
    // An optional stories request must not reject Home's rendering effect.
    return {} as Record<string, SocialMediaItem>;
  }
}
