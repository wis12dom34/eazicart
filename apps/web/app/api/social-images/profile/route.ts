import { list } from "@vercel/blob";

export const dynamic = "force-dynamic";

const validUserId = (value: string) => /^[a-zA-Z0-9_-]{8,80}$/.test(value);

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId")?.trim() ?? "";
  if (!validUserId(userId)) return Response.json({ data: null }, { status: 400 });

  const { blobs } = await list({ prefix: `profiles/${userId}/`, limit: 100 });
  const latest = [...blobs].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )[0];

  return Response.json({
    data: latest ? { url: latest.url, uploadedAt: latest.uploadedAt } : null,
  });
}
