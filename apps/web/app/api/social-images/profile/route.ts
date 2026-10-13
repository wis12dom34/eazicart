import { list } from "@vercel/blob";

export const dynamic = "force-dynamic";

const validUserId = (value: string) => /^[a-zA-Z0-9_-]{8,80}$/.test(value);

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId")?.trim() ?? "";
  if (!validUserId(userId))
    return Response.json({ data: null }, { status: 400 });

  // Blob listings are paginated. The newest upload can be beyond page one.
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

  return Response.json({
    data: latest ? { url: latest.url, uploadedAt: latest.uploadedAt } : null,
  });
}
