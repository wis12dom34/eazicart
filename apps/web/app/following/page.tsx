"use client";
import Link from "next/link";
import { Header } from "../components/header";
import { followsApi } from "../../lib/api/follows";
import { useRequest } from "../hooks/use-request";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
export default function Following() {
  const auth = useAuth();
  const result = useRequest(
    async () =>
      auth.isAuthenticated ? followsApi.list() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const remove = async (id: string) => {
    try {
      await followsApi.unfollow(id);
      await result.reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Unable to unfollow");
    }
  };
  return (
    <main className="app-shell">
      <Header title="Following" back="/profile" />
      {auth.loading || result.loading ? (
        <LoadingState />
      ) : !auth.isAuthenticated ? (
        <SignInState />
      ) : result.error ? (
        <ErrorState message={result.error} />
      ) : !result.data?.data.length ? (
        <EmptyState message="You are not following any sellers." />
      ) : (
        <section className="following-list">
          {result.data.data.map((f) => {
            const s = f.seller.sellerProfile;
            return (
              <article key={f.sellerId}>
                <Link
                  href={`/seller/${s?.id ?? f.sellerId}`}
                  className="seller-avatar small"
                >
                  {(s?.displayName ?? f.seller.name).slice(0, 2).toUpperCase()}
                </Link>
                <div>
                  <strong>{s?.displayName ?? f.seller.name}</strong>
                  <small>Seller</small>
                </div>
                <button
                  className="secondary-button small-button"
                  onClick={() => void remove(f.sellerId)}
                >
                  Following
                </button>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

