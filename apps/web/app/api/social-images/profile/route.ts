import { del, list } from "@vercel/blob";

export const dynamic = "force-dynamic";
const validUserId = (value: string) => /^[a-zA-Z0-9_-]{8,80}$/.test(value);
const apiBaseUrl = process.env.EAZICART_PUBLIC_API_URL?.replace(/\/$/, "");

async function allProfileBlobs(userId: string) {
  let cursor: string | undefined;
  const blobs: Array<{ url: string; uploadedAt: Date }> = [];
  do {
    const page = await list({ prefix: `profiles/${userId}/`, limit: 1000, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId")?.trim() ?? "";
  if (!validUserId(userId)) return Response.json({ data: null }, { status: 400 });
  const blobs = await allProfileBlobs(userId);
  const latest = blobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
  return Response.json({ data: latest ? { url: latest.url, uploadedAt: latest.uploadedAt } : null });
}

export async function DELETE(request: Request) {
  try {
    const input = (await request.json()) as { userId?: unknown; accessToken?: unknown };
    const userId = typeof input.userId === "string" ? input.userId.trim() : "";
    const accessToken = typeof input.accessToken === "string" ? input.accessToken.trim() : "";
    if (!validUserId(userId) || !accessToken || !apiBaseUrl) return Response.json({ error: "Unable to remove this profile photo." }, { status: 400 });
    const auth = await fetch(`${apiBaseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!auth.ok) return Response.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    const user = (await auth.json()) as { id?: unknown };
    if (user.id !== userId) return Response.json({ error: "You can only remove your own profile photo." }, { status: 403 });
    const blobs = await allProfileBlobs(userId);
    if (blobs.length) await del(blobs.map((blob) => blob.url));
    return Response.json({ data: null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not remove profile photo" }, { status: 400 });
  }
}
