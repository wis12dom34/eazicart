/* eslint-disable @next/next/no-img-element */
import { list } from "@vercel/blob";
import Link from "next/link";
import { getPublicProducts } from "../../../lib/public-catalog";

export const dynamic = "force-dynamic";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const validUserId = (value: string) => /^[a-zA-Z0-9_-]{8,80}$/.test(value);
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

function relativeTime(value: string | Date) {
  const then = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

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
  const story = [...storyBlobs]
    .filter((blob) => new Date(blob.uploadedAt).getTime() >= cutoff)
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    )[0];

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
  const storyTitle = sellerProduct?.name || sellerName;
  const storySubtitle = sellerProduct
    ? "New arrivals · Just dropped"
    : "Seller story";
  const initials = sellerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";

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
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, sans-serif',
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
            aria-label={`${sellerName} story video`}
            style={mediaStyle}
          />
        ) : (
          <img
            src={story.url}
            alt={`${sellerName} story`}
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

      {story ? (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              pointerEvents: "none",
              background:
                "linear-gradient(180deg, rgba(0,0,0,.48) 0%, rgba(0,0,0,.12) 17%, rgba(0,0,0,0) 47%, rgba(0,0,0,.04) 64%, rgba(0,0,0,.58) 100%)",
            }}
          />

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              zIndex: 3,
              top: "calc(env(safe-area-inset-top, 0px) + 12px)",
              left: 20,
              right: 20,
              height: 3,
              borderRadius: 999,
              background: "rgba(255,255,255,.38)",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,.14)",
            }}
          >
            <span
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                borderRadius: "inherit",
                background: "rgba(255,255,255,.96)",
              }}
            />
          </div>

          <div
            style={{
              position: "absolute",
              zIndex: 3,
              top: "calc(env(safe-area-inset-top, 0px) + 31px)",
              left: 20,
              display: "flex",
              alignItems: "center",
              gap: 11,
              maxWidth: "calc(100vw - 104px)",
              textShadow: "0 1px 5px rgba(0,0,0,.35)",
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                flex: "0 0 58px",
                padding: 3,
                borderRadius: "50%",
                background: "rgba(255,255,255,.98)",
                boxShadow: "0 1px 5px rgba(0,0,0,.18)",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  overflow: "hidden",
                  display: "grid",
                  placeItems: "center",
                  background: "#161616",
                  color: "#fff",
                  fontSize: 17,
                  fontWeight: 700,
                }}
              >
                {profile ? (
                  <img
                    src={profile.url}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "block",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  initials
                )}
              </div>
            </div>

            <div style={{ minWidth: 0, paddingTop: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <strong
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "#fff",
                    fontSize: 17,
                    lineHeight: "21px",
                    fontWeight: 700,
                    letterSpacing: "-0.2px",
                  }}
                >
                  {sellerName}
                </strong>
                {sellerProduct ? (
                  <span
                    aria-label="Verified seller"
                    title="Verified seller"
                    style={{
                      width: 20,
                      height: 20,
                      flex: "0 0 20px",
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: "#1d9bf0",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      lineHeight: 1,
                      textShadow: "none",
                    }}
                  >
                    ✓
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  marginTop: 3,
                  color: "rgba(255,255,255,.72)",
                  fontSize: 15,
                  lineHeight: "19px",
                  fontWeight: 500,
                }}
              >
                {relativeTime(story.uploadedAt)}
              </div>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              zIndex: 3,
              left: 26,
              right: 24,
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
              textShadow: "0 2px 12px rgba(0,0,0,.45)",
            }}
          >
            <h1
              style={{
                maxWidth: "88%",
                margin: 0,
                color: "#fff",
                fontSize: "clamp(28px, 8vw, 38px)",
                lineHeight: 1.04,
                fontWeight: 800,
                letterSpacing: "-1.1px",
              }}
            >
              {storyTitle}
            </h1>
            <p
              style={{
                margin: "14px 0 0",
                color: "rgba(255,255,255,.75)",
                fontSize: "clamp(17px, 4.8vw, 22px)",
                lineHeight: 1.25,
                fontWeight: 500,
                letterSpacing: "-0.25px",
              }}
            >
              {storySubtitle}
            </p>
          </div>
        </>
      ) : null}

      <Link
        href="/"
        aria-label="Close story"
        style={{
          position: "absolute",
          zIndex: 4,
          top: "calc(env(safe-area-inset-top, 0px) + 30px)",
          right: 15,
          width: 54,
          height: 46,
          display: "grid",
          placeItems: "center",
          borderRadius: 999,
          background: "rgba(0,0,0,.76)",
          WebkitBackdropFilter: "blur(16px)",
          backdropFilter: "blur(16px)",
          color: "#fff",
          textDecoration: "none",
          boxShadow: "0 2px 12px rgba(0,0,0,.18)",
        }}
      >
        <svg
          width="25"
          height="25"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </Link>
    </main>
  );
}
