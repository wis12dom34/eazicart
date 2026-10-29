import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const allowedContentTypes = ["image/jpeg", "image/png", "image/webp"];

const apiBaseUrl = process.env.EAZICART_PUBLIC_API_URL?.replace(/\/$/, "");

async function requireSeller(clientPayload: string | null) {
  if (!apiBaseUrl) {
    throw new Error("Product photo uploads are not configured yet.");
  }

  let accessToken = "";
  try {
    const payload = JSON.parse(clientPayload || "{}") as {
      accessToken?: unknown;
    };
    accessToken =
      typeof payload.accessToken === "string" ? payload.accessToken.trim() : "";
  } catch {
    throw new Error("Your seller session is invalid. Please sign in again.");
  }

  if (!accessToken) {
    throw new Error("Please sign in again before uploading product photos.");
  }

  const response = await fetch(`${apiBaseUrl}/seller-profile`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Your seller session expired. Please sign in again.");
  }

  const payload = (await response.json()) as {
    data?: { id?: unknown } | null;
  };
  const sellerId =
    payload.data && typeof payload.data.id === "string" ? payload.data.id : "";

  if (!sellerId) {
    throw new Error("Create a seller profile before uploading product photos.");
  }

  return sellerId;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith("products/")) {
          throw new Error("Invalid product photo path.");
        }

        const sellerId = await requireSeller(clientPayload);
        return {
          allowedContentTypes,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ sellerId }),
        };
      },
      onUploadCompleted: async () => {
        // Product image URLs are attached to the product only when the seller saves.
      },
    });

    return Response.json(response);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare this product photo upload.",
      },
      { status: 400 },
    );
  }
}
