import { listActiveStories } from "../../../../lib/story-storage";

export const dynamic = "force-dynamic";

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

  try {
    const now = Date.now();
    const pairs = await Promise.all(
      userIds.map(async (userId) => {
        const stories = await listActiveStories(userId, now);
        const latest = stories.at(-1);
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
  } catch {
    return Response.json(
      { error: "Stories are temporarily unavailable." },
      { status: 503 },
    );
  }
}
