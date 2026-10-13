/* eslint-disable @next/next/no-img-element */
import { list } from "@vercel/blob";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const videoFile = (url: string, contentType?: string) =>
  contentType?.startsWith("video/") || /\.(mp4|mov|webm)(?:\?|$)/i.test(url);

export default async function StoryPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const { blobs } = await list({ prefix: `stories/${userId}/`, limit: 50 });
  const cutoff = Date.now() - STORY_TTL_MS;
  const story = [...blobs]
    .filter((blob) => new Date(blob.uploadedAt).getTime() >= cutoff)
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    )[0];

  return (
    <main
      style={{
        minHeight: "100svh",
        maxWidth: 440,
        margin: "0 auto",
        background: "#080808",
        color: "#fff",
        position: "relative",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      <Link
        href="/"
        aria-label="Close story"
        style={{
          position: "absolute",
          zIndex: 2,
          top: "calc(16px + env(safe-area-inset-top))",
          left: 16,
          width: 44,
          height: 44,
          display: "grid",
          placeItems: "center",
          borderRadius: 22,
          background: "rgba(0,0,0,.35)",
          color: "white",
          textDecoration: "none",
          fontSize: 32,
        }}
      >
        ‹
      </Link>
      {story ? (
        videoFile(story.url, story.contentType) ? (
          <video
            src={story.url}
            autoPlay
            playsInline
            controls
            style={{ width: "100%", height: "100svh", objectFit: "cover" }}
          />
        ) : (
          <img
            src={story.url}
            alt="Seller story"
            style={{ width: "100%", height: "100svh", objectFit: "cover" }}
          />
        )
      ) : (
        <p style={{ padding: 24, color: "#d1d1d6" }}>This story has expired.</p>
      )}
    </main>
  );
}
