import { cachedProfilePhoto } from "../../../../lib/blob-media-cache";

export const dynamic = "force-dynamic";

const validUserId = (value: string) => /^[a-zA-Z0-9_-]{8,80}$/.test(value);

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId")?.trim() ?? "";
  if (!validUserId(userId))
    return Response.json({ data: null }, { status: 400 });

  const latest = await cachedProfilePhoto(userId);
  return Response.json({ data: latest });
}
