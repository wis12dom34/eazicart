import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

const PROFILE_MAX_BYTES = 8 * 1024 * 1024;
const STORY_MAX_BYTES = 50 * 1024 * 1024;
const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const storyTypes = [
  ...imageTypes,
  "video/mp4",
  "video/quicktime",
  "video/webm",
];
const apiBaseUrl = process.env.EAZICART_PUBLIC_API_URL?.replace(/\/$/, "");

async function requireUser(clientPayload: string | null) {
  if (!apiBaseUrl)
    throw new Error("Social media uploads are not configured yet.");

  let accessToken = "";
  try {
    const payload = JSON.parse(clientPayload || "{}") as {
      accessToken?: unknown;
    };
    accessToken =
      typeof payload.accessToken === "string" ? payload.accessToken.trim() : "";
  } catch {
    throw new Error("Your session is invalid. Please sign in again.");
  }

  if (!accessToken)
    throw new Error("Please sign in again before uploading media.");

  const response = await fetch(`${apiBaseUrl}/users/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error("Your session expired. Please sign in again.");

  const user = (await response.json()) as { id?: unknown };
  const userId = typeof user.id === "string" ? user.id : "";
  if (!userId) throw new Error("Unable to identify your EaziCart account.");
  return userId;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const userId = await requireUser(clientPayload);
        const profileUpload = pathname.startsWith(`profiles/${userId}/`);
        const storyUpload = pathname.startsWith(`stories/${userId}/`);
        if (!profileUpload && !storyUpload)
          throw new Error("Invalid social media path.");

        return {
          allowedContentTypes: profileUpload ? imageTypes : storyTypes,
          maximumSizeInBytes: profileUpload
            ? PROFILE_MAX_BYTES
            : STORY_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId }),
        };
      },
      onUploadCompleted: async () => {
        // Hosted media is resolved directly from its user-scoped Blob path.
      },
    });
    return Response.json(response);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare this media upload.",
      },
      { status: 400 },
    );
  }
}
