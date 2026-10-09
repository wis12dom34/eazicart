"use client";

import Link from "next/link";
import { useState } from "react";

import { followsApi } from "../../lib/api/follows";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import styles from "./following.module.css";

type FollowedSeller = Awaited<
  ReturnType<typeof followsApi.list>
>["data"][number] & {
  followerCount?: number;
};

export default function FollowingPage() {
  const auth = useAuth();
  const [removing, setRemoving] = useState<string>();
  const [actionError, setActionError] = useState("");

  const result = useRequest(async () => {
    if (!auth.isAuthenticated) return undefined;

    const follows = await followsApi.list();
    const data = await Promise.all(
      follows.data.map(async (follow): Promise<FollowedSeller> => {
        try {
          const count = await followsApi.count(follow.sellerId);
          return { ...follow, followerCount: count.data.count };
        } catch {
          return follow;
        }
      }),
    );

    return { data };
  }, [auth.isAuthenticated]);

  const remove = async (id: string) => {
    setRemoving(id);
    setActionError("");
    try {
      await followsApi.unfollow(id);
      result.setData((current) =>
        current
          ? {
              data: current.data.filter((follow) => follow.sellerId !== id),
            }
          : current,
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to unfollow seller",
      );
    } finally {
      setRemoving(undefined);
    }
  };

  return (
    <main className={`app-shell with-nav ${styles.page}`}>
      <header className={styles.header}>
        <Link
          className={styles.backButton}
          href="/profile"
          aria-label="Back to profile"
        >
          <Icon name="back" size={22} />
        </Link>
        <h1>Saved</h1>
        <p>Sellers you want to keep up with</p>
      </header>

      <nav className={styles.tabs} aria-label="Saved sections">
        <Link href="/saved">Products</Link>
        <span className={styles.activeTab} aria-current="page">
          Sellers
        </span>
      </nav>

      {actionError ? (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      ) : null}

      <section className={styles.viewport}>
        {auth.loading || result.loading ? (
          <LoadingState label="Loading followed sellers…" />
        ) : !auth.isAuthenticated ? (
          <SignInState message="Sign in to view the sellers you follow." />
        ) : result.error ? (
          <ErrorState
            message={result.error}
            retry={() => void result.reload()}
          />
        ) : !result.data?.data.length ? (
          <EmptyState
            title="You’re not following any sellers"
            message="Follow stores you like and they’ll appear here."
            action={{
              href: "/explore?section=sellers",
              label: "Explore sellers",
            }}
          />
        ) : (
          <div className={styles.feed} aria-label="Followed sellers">
            {result.data.data.map((follow) => {
              const seller = follow.seller.sellerProfile;
              const displayName = seller?.displayName ?? follow.seller.name;
              const href = `/seller/${seller?.id ?? follow.sellerId}`;
              const isRemoving = removing === follow.sellerId;

              return (
                <article className={styles.sellerCard} key={follow.sellerId}>
                  <Link
                    href={href}
                    className={styles.avatar}
                    aria-label={`View ${displayName}`}
                  >
                    {displayName.slice(0, 2).toUpperCase()}
                  </Link>

                  <Link className={styles.sellerIdentity} href={href}>
                    <strong>{displayName}</strong>
                    <span>
                      {follow.followerCount === undefined
                        ? "Seller"
                        : followersLabel(follow.followerCount)}
                    </span>
                  </Link>

                  {seller?.bio ? (
                    <p className={styles.bio}>{seller.bio}</p>
                  ) : (
                    <p className={styles.bio}>
                      Follow this seller to keep them in your Saved sellers.
                    </p>
                  )}

                  <div className={styles.cardFooter}>
                    <Link className={styles.viewSeller} href={href}>
                      View seller
                    </Link>
                    <button
                      className={styles.followingButton}
                      type="button"
                      onClick={() => void remove(follow.sellerId)}
                      disabled={Boolean(removing)}
                      aria-label={`Unfollow ${displayName}`}
                      aria-busy={isRemoving}
                    >
                      Following
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <BottomNavigation />
    </main>
  );
}

function followersLabel(count: number) {
  return `${new Intl.NumberFormat("en-NG", { notation: "compact" }).format(
    count,
  )} ${count === 1 ? "follower" : "followers"}`;
}
