import { cachedStory } from "../../../../lib/blob-media-cache";

export const dynamic = "force-dynamic";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const validUserId = (value: string) => /^[a-zA-Z0-9_-]{8,80}$/.test(value);

function contentTypeFromPathname(pathname: string) {
  const value = pathname.toLowerCase();
  if (/\.mp4$/.test(value)) return "video/mp4";
  if (/\.mov$/.test(value)) return "video/quicktime";
  if (/\.webm$/.test(value)) return "video/webm";
  if (/\.png$/.test(value)) return "image/png";
  if (/\.webp$/.test(value)) return "image/webp";
  if (/\.jpe?g$/.test(value)) return "image/jpeg";
  return undefined;
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("userIds") ?? "";
  const userIds = Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(validUserId),
    ),
  ).slice(0, 12);

  const cutoff = Date.now() - STORY_TTL_MS;
  const pairs = await Promise.all(
    userIds.map(async (userId) => {
      const cached = await cachedStory(userId);
      const latest =
        cached && new Date(cached.uploadedAt).getTime() >= cutoff
          ? cached
          : null;
      return [
        userId,
        latest
          ? {
              url: latest.url,
              uploadedAt: latest.uploadedAt,
              contentType: contentTypeFromPathname(latest.pathname),
            }
          : null,
      ] as const;
    }),
  );

  return Response.json({
    data: Object.fromEntries(pairs.filter(([, story]) => Boolean(story))),
  });
}
