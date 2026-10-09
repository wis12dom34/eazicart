/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import type { Reel } from "../../lib/api/reels";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/async-state";

export function TrendingSection({
  reels,
  loading,
  error,
  retry,
}: {
  reels: Reel[];
  loading: boolean;
  error?: string;
  retry: () => void;
}) {
  const trending = [...reels]
    .sort((a, b) => b._count.views - a._count.views)
    .slice(0, 12);

  return (
    <section
      className="figma-explore-reels"
      aria-labelledby="explore-trending"
    >
      <div>
        <h2 id="explore-trending">Trending now</h2>
        <Link href="/reels">View all ›</Link>
      </div>
      {loading ? (
        <LoadingState label="Loading trending products…" />
      ) : error ? (
        <ErrorState message={error} retry={retry} />
      ) : trending.length ? (
        <div className="figma-explore-reel-strip">
          {trending.map((reel) => (
            <Link
              className="figma-explore-reel"
              href={`/reels?reelId=${encodeURIComponent(reel.id)}`}
              key={reel.id}
            >
              {reel.thumbnailUrl || reel.product?.images[0]?.url ? (
                <img
                  src={
                    reel.thumbnailUrl ?? reel.product?.images[0]?.url ?? ""
                  }
                  alt=""
                />
              ) : (
                <i />
              )}
              <strong>{reel.caption || reel.product?.name || "Reel"}</strong>
              <span>▶ {reel._count.views}</span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState message="No trending activity is available yet." />
      )}
    </section>
  );
}
