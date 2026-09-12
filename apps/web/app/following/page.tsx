"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { followsApi } from "../../lib/api/follows";
import { useRequest } from "../hooks/use-request";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
import styles from "./following.module.css";

type FollowedSeller = Awaited<
  ReturnType<typeof followsApi.list>
>["data"][number] & {
  followerCount?: number;
};

export default function FollowingPage() {
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const result = useRequest(
    async () => {
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
    },
    [auth.isAuthenticated],
  );

  const sellers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return result.data?.data ?? [];

    return (result.data?.data ?? []).filter((follow) => {
      const profile = follow.seller.sellerProfile;
      return [profile?.displayName, follow.seller.name, profile?.bio]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));
    });
  }, [result.data, search]);

  const remove = async (id: string) => {
    try {
      await followsApi.unfollow(id);
      await result.reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Unable to unfollow");
    }
  };

  return (
    <main className={`app-shell with-nav ${styles.page}`}>
      <header className={styles.header}>
        <Link href="/profile" aria-label="Back to profile">
          <Icon name="back" size={22} />
        </Link>
        <h1>Saved Sellers</h1>
        <p>Stores you follow and trust</p>
      </header>

      <label className={styles.search}>
        <Icon name="search" size={17} />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search saved sellers"
          aria-label="Search saved sellers"
        />
      </label>

      {auth.loading || result.loading ? (
        <LoadingState label="Loading saved sellers…" />
      ) : !auth.isAuthenticated ? (
        <SignInState message="Sign in to view the sellers you follow." />
      ) : result.error ? (
        <ErrorState
          message={result.error}
          retry={() => void result.reload()}
        />
      ) : !result.data?.data.length ? (
        <EmptyState message="You are not following any sellers." />
      ) : !sellers.length ? (
        <EmptyState message="No saved sellers match your search." />
      ) : (
        <section className={styles.list} aria-label="Saved sellers">
          {sellers.map((follow) => {
            const seller = follow.seller.sellerProfile;
            const displayName = seller?.displayName ?? follow.seller.name;
            return (
              <article className={styles.sellerCard} key={follow.sellerId}>
                <Link
                  href={`/seller/${seller?.id ?? follow.sellerId}`}
                  className={styles.avatar}
                  aria-label={`View ${displayName}`}
                >
                  {displayName.slice(0, 2).toUpperCase()}
                </Link>
                <Link
                  className={styles.sellerCopy}
                  href={`/seller/${seller?.id ?? follow.sellerId}`}
                >
                  <strong>{displayName}</strong>
                  {follow.followerCount !== undefined ? (
                    <span>{followersLabel(follow.followerCount)}</span>
                  ) : null}
                  {seller?.bio ? <small>{seller.bio}</small> : null}
                </Link>
                <button
                  className={styles.followingButton}
                  type="button"
                  onClick={() => void remove(follow.sellerId)}
                  aria-label={`Unfollow ${displayName}`}
                >
                  Following
                </button>
              </article>
            );
          })}
        </section>
      )}
      <BottomNavigation />
    </main>
  );
}

function followersLabel(count: number) {
  return `${new Intl.NumberFormat("en-NG", { notation: "compact" }).format(
    count,
  )} ${count === 1 ? "follower" : "followers"}`;
}
