import { upload } from "@vercel/blob/client";
import { tokenStore } from "./api/client";

const PROFILE_MAX_BYTES = 8 * 1024 * 1024;
const STORY_MAX_BYTES = 50 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const profilePhotoCache = new Map<
  string,
  Promise<SocialMediaItem | null>
>();

export const PROFILE_PHOTO_EVENT = "eazicart:profile-photo-updated";

export type SocialMediaItem = {
  url: string;
  uploadedAt: string;
  contentType?: string;
};

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
  const cleaned = file.name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (cleaned) return cleaned;
  if (file.type === "video/quicktime") return "story.mov";
  if (file.type === "video/mp4") return "story.mp4";
  if (file.type === "video/webm") return "story.webm";
  if (file.type === "image/png") return "photo.png";
  if (file.type === "image/webp") return "photo.webp";
  return "photo.jpg";
}

function validateMedia(kind: "profile" | "story", file: File) {
  const image =
    imageTypes.has(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
  const video =
    videoTypes.has(file.type) || /\.(mp4|mov|webm)$/i.test(file.name);

  if (kind === "profile" && !image)
    throw new Error("Choose a JPG, PNG or WebP profile photo.");
  if (kind === "story" && !image && !video)
    throw new Error("Choose a photo or video from your gallery.");

  const maxBytes = kind === "profile" ? PROFILE_MAX_BYTES : STORY_MAX_BYTES;
  if (file.size > maxBytes)
    throw new Error(
      kind === "profile"
        ? "Choose a profile photo smaller than 8 MB."
        : "Choose a story smaller than 50 MB.",
    );
}

export async function uploadSocialMedia(
  kind: "profile" | "story",
  userId: string,
  file: File,
  onProgress?: (percentage: number) => void,
) {
  validateMedia(kind, file);
  const accessToken = tokenStore.get()?.accessToken;
  if (!accessToken)
    throw new Error("Please sign in again before uploading media.");

  const folder = kind === "profile" ? "profiles" : "stories";
  const blob = await upload(
    `${folder}/${userId}/${Date.now()}-${safeFileName(file)}`,
    file,
    {
      access: "public",
      handleUploadUrl: "/api/social-images/upload",
      clientPayload: JSON.stringify({ accessToken }),
      contentType: file.type || undefined,
      multipart: file.size > 4 * 1024 * 1024,
      onUploadProgress: ({ percentage }) => onProgress?.(percentage),
    },
  );
  const item = {
    url: blob.url,
    uploadedAt: new Date().toISOString(),
    contentType: file.type || contentTypeFromName(file.name),
  };

  if (kind === "profile") {
    profilePhotoCache.set(userId, Promise.resolve(item));
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(PROFILE_PHOTO_EVENT, {
          detail: { userId, photo: item },
        }),
      );
    }
  }

  return item;
}

export async function fetchProfilePhoto(userId: string) {
  const cached = profilePhotoCache.get(userId);
  if (cached) return cached;

  const request = fetch(
    `/api/social-images/profile?userId=${encodeURIComponent(userId)}`,
    { cache: "no-store" },
  )
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        data?: SocialMediaItem | null;
      };
      return payload.data ?? null;
    })
    .catch(() => {
      profilePhotoCache.delete(userId);
      return null;
    });

  profilePhotoCache.set(userId, request);
  return request;
}

export async function fetchStories(userIds: string[]) {
  if (!userIds.length) return {} as Record<string, SocialMediaItem>;
  const response = await fetch(
    `/api/social-images/stories?userIds=${encodeURIComponent(userIds.join(","))}`,
    { cache: "no-store" },
  );
  if (!response.ok) return {} as Record<string, SocialMediaItem>;
  const payload = (await response.json()) as {
    data?: Record<string, SocialMediaItem>;
  };
  const stories = payload.data ?? {};
  return Object.fromEntries(
    Object.entries(stories).map(([userId, story]) => [
      userId,
      {
        ...story,
        contentType: story.contentType || contentTypeFromName(story.url),
      },
    ]),
  ) as Record<string, SocialMediaItem>;
}
