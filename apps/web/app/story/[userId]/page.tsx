/* eslint-disable @next/next/no-img-element */
import { list } from "@vercel/blob";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const videoFile = (url: string) => /\.(mp4|mov|webm)(?:\?|$)/i.test(url);

const mediaStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  minWidth: "100%",
  minHeight: "100%",
  display: "block",
  objectFit: "cover",
  objectPosition: "center center",
  background: "#000",
} as const;

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
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        width: "100vw",
        height: "100dvh",
        minHeight: "100svh",
        overflow: "hidden",
        overscrollBehavior: "none",
        background: "#000",
        color: "#fff",
      }}
    >
      {story ? (
        videoFile(story.url) ? (
          <video
            src={story.url}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="Story video"
            style={mediaStyle}
          />
        ) : (
          <img
            src={story.url}
            alt="Story"
            draggable={false}
            style={mediaStyle}
          />
        )
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "#000",
            color: "#d1d1d6",
            textAlign: "center",
            fontSize: 15,
          }}
        >
          This story has expired.
        </div>
      )}

      <Link
        href="/"
        aria-label="Back"
        style={{
          position: "absolute",
          zIndex: 3,
          top: "calc(env(safe-area-inset-top, 0px) + 24px)",
          left: 24,
          width: 44,
          height: 44,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          background: "rgba(25, 25, 25, 0.46)",
          WebkitBackdropFilter: "blur(14px)",
          backdropFilter: "blur(14px)",
          color: "#fff",
          textDecoration: "none",
          boxShadow: "0 1px 8px rgba(0,0,0,.08)",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M15 5.5 8.5 12l6.5 6.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </main>
  );
}
