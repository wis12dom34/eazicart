import { list } from "@vercel/blob";
import { getPublicProducts } from "../../../lib/public-catalog";
import StoryViewer from "./story-viewer";

export const dynamic = "force-dynamic";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const validUserId = (value: string) => /^[a-zA-Z0-9_-]{8,80}$/.test(value);
const videoFile = (url: string) => /\.(mp4|mov|webm)(?:\?|$)/i.test(url);

export default async function StoryPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const safeUserId = validUserId(userId) ? userId : "";

  const [{ blobs: storyBlobs }, { blobs: profileBlobs }, productsResult] =
    await Promise.all([
      safeUserId
        ? list({ prefix: `stories/${safeUserId}/`, limit: 50 })
        : Promise.resolve({ blobs: [] }),
      safeUserId
        ? list({ prefix: `profiles/${safeUserId}/`, limit: 50 })
        : Promise.resolve({ blobs: [] }),
      getPublicProducts("limit=100"),
    ]);

  const cutoff = Date.now() - STORY_TTL_MS;
  const stories = [...storyBlobs]
    .filter((blob) => new Date(blob.uploadedAt).getTime() >= cutoff)
    .sort(
      (a, b) =>
        new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime(),
    )
    .map((blob) => ({
      url: blob.url,
      uploadedAt: new Date(blob.uploadedAt).toISOString(),
      isVideo: videoFile(blob.url),
    }));

  const profile = [...profileBlobs].sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )[0];

  const sellerProduct =
    productsResult.status === "ok"
      ? productsResult.data.data.find(
          (product) => product.seller.userId === safeUserId,
        )
      : undefined;

  const sellerName = sellerProduct?.seller.displayName || "Seller";
  const initials =
    sellerName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "S";

  if (!stories.length) {
    return (
      <main
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          width: "100vw",
          height: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          overflow: "hidden",
          background: "#000",
          color: "#d1d1d6",
          textAlign: "center",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif',
          fontSize: 15,
        }}
      >
        This story has expired.
      </main>
    );
  }

  return (
    <StoryViewer
      stories={stories}
      sellerName={sellerName}
      initials={initials}
      profileUrl={profile?.url}
      verified={Boolean(sellerProduct)}
      product={
        sellerProduct
          ? {
              id: sellerProduct.id,
              name: sellerProduct.name,
              price: String(sellerProduct.price),
              stock: sellerProduct.stock,
              imageUrl: sellerProduct.images[0]?.url,
              sellerId: sellerProduct.seller.id,
            }
          : undefined
      }
    />
  );
}
