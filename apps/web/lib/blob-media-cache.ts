import { list } from "@vercel/blob";
import { unstable_cache } from "next/cache";

export const socialMediaCacheTag = (userId: string) => `social-media:${userId}`;

async function latestProfilePhoto(userId: string) {
  let cursor: string | undefined;
  let latest: { url: string; uploadedAt: Date } | undefined;
  do {
    const page = await list({
      prefix: `profiles/${userId}/`,
      limit: 1000,
      cursor,
    });
    for (const blob of page.blobs) {
      if (
        !latest ||
        new Date(blob.uploadedAt).getTime() >
          new Date(latest.uploadedAt).getTime()
      )
        latest = blob;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return latest
    ? { url: latest.url, uploadedAt: new Date(latest.uploadedAt).toISOString() }
    : null;
}

export function cachedProfilePhoto(userId: string) {
  return unstable_cache(latestProfilePhoto, ["profile-photo-v1", userId], {
    tags: [socialMediaCacheTag(userId)],
    revalidate: 3600,
  })(userId);
}

async function latestStory(userId: string) {
  const { blobs } = await list({ prefix: `stories/${userId}/`, limit: 50 });
  const latest = [...blobs].sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )[0];
  return latest
    ? {
        url: latest.url,
        pathname: latest.pathname,
        uploadedAt: new Date(latest.uploadedAt).toISOString(),
      }
    : null;
}

export function cachedStory(userId: string) {
  return unstable_cache(latestStory, ["latest-story-v1", userId], {
    tags: [socialMediaCacheTag(userId)],
    revalidate: 300,
  })(userId);
}
