import { listActiveStories } from "../../../lib/story-storage";
import { getPublicProducts } from "../../../lib/public-catalog";
import StoryViewer from "./story-viewer";

export const dynamic = "force-dynamic";

const validUserId = (value: string) => /^[a-zA-Z0-9_-]{8,80}$/.test(value);
const videoFile = (url: string) => /\.(mp4|mov|webm)(?:\?|$)/i.test(url);

export default async function StoryPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const safeUserId = validUserId(userId) ? userId : "";

  const [storyBlobs, productsResult] = await Promise.all([
    safeUserId ? listActiveStories(safeUserId) : Promise.resolve([]),
    getPublicProducts("limit=100"),
  ]);

  const stories = storyBlobs.map((blob) => ({
    url: blob.url,
    uploadedAt: new Date(blob.uploadedAt).toISOString(),
    isVideo: videoFile(blob.url),
  }));

  const sellerProduct =
    productsResult.status === "ok"
      ? productsResult.data.data.find(
          (product) => product.seller.userId === safeUserId,
        )
      : undefined;
  const seller = sellerProduct?.seller;
  const sellerName = seller?.displayName || "Seller";

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
      userId={safeUserId}
      sellerId={seller?.id}
      verified={false}
    />
  );
}
