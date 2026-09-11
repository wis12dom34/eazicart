"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../components/header";
import { ProductGrid } from "../../components/product-card";
import { ErrorState, LoadingState } from "../../components/async-state";
import { sellersApi } from "../../../lib/api/sellers";
import { followsApi } from "../../../lib/api/follows";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
export default function SellerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const auth = useAuth();
  const router = useRouter();
  const [following, setFollowing] = useState(false);
  const [message, setMessage] = useState("");
  const seller = useRequest(() => sellersApi.get(id), [id]);
  const products = useRequest(() => sellersApi.products(id), [id]);
  const count = useRequest(
    () => followsApi.count(seller.data?.data.userId ?? id),
    [seller.data?.data.userId, id],
  );
  if (seller.loading)
    return (
      <main className="app-shell">
        <Header title="Shop" back="/explore" />
        <LoadingState />
      </main>
    );
  if (seller.error || !seller.data)
    return (
      <main className="app-shell">
        <Header title="Shop" back="/explore" />
        <ErrorState message={seller.error || "Seller not found"} />
      </main>
    );
  const s = seller.data.data;
  const follow = async () => {
    if (!auth.isAuthenticated) return router.push(`/login?next=/seller/${id}`);
    try {
      if (following) await followsApi.unfollow(s.userId);
      else await followsApi.follow(s.userId);
      setFollowing(!following);
      await count.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to update follow");
    }
  };
  return (
    <main className="app-shell">
      <Header title="Shop" back="/explore" />
      <section className="seller-hero">
        <div className="seller-avatar">
          {s.displayName.slice(0, 2).toUpperCase()}
        </div>
        <h2>{s.displayName}</h2>
        <p>{s.bio || "Verified seller"}</p>
        <div className="seller-stats">
          <span>
            <strong>{count.data?.data.count ?? s.followerCount ?? 0}</strong>
            Followers
          </span>
          <span>
            <strong>
              {s._count?.products ?? products.data?.data.length ?? 0}
            </strong>
            Products
          </span>
        </div>
        <button
          className={
            following ? "secondary-button compact" : "dark-button compact"
          }
          onClick={() => void follow()}
        >
          {following ? "Following" : "Follow"}
        </button>
        {message && <p role="alert">{message}</p>}
      </section>
      <section className="section">
        <div className="filter-tabs">
          <button className="active">Shop</button>
          <button>About</button>
          <button>Reviews</button>
        </div>
        {products.loading ? (
          <LoadingState />
        ) : products.error ? (
          <ErrorState message={products.error} retry={products.reload} />
        ) : (
          <ProductGrid products={products.data?.data ?? []} />
        )}
      </section>
    </main>
  );
}
