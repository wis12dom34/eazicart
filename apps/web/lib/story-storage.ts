import { list, type ListBlobResultBlob } from "@vercel/blob";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

// Blob listings are paginated, not newest-first. Old uploads must not hide
// active stories on a later page. Share the same window/order with the viewer.
export async function listActiveStories(userId: string, now = Date.now()) {
  const cutoff = now - STORY_TTL_MS;
  const stories: ListBlobResultBlob[] = [];
  const abortSignal = AbortSignal.timeout(10_000);
  let cursor: string | undefined;
  do {
    const page = await list({
      prefix: `stories/${userId}/`,
      limit: 1000,
      cursor,
      abortSignal,
    });
    stories.push(
      ...page.blobs.filter((blob) => {
        const uploadedAt = new Date(blob.uploadedAt).getTime();
        return uploadedAt >= cutoff && uploadedAt <= now;
      }),
    );
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return stories.sort(
    (a, b) =>
      new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime(),
  );
}
