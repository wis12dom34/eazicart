import { notFound } from "next/navigation";
import { Header } from "../../components/header";
import { ProductGrid } from "../../components/product-card";
import { products, sellers } from "../../data";
export default async function SellerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seller = sellers.find((s) => s.id === id);
  if (!seller) notFound();
  return (
    <main className="app-shell">
      <Header title="Shop" back="/explore" />
      <section className="seller-hero">
        <div className="seller-avatar">{seller.initials}</div>
        <h2>{seller.name}</h2>
        <p>{seller.handle} · Verified seller</p>
        <div className="seller-stats">
          <span>
            <strong>{seller.followers}</strong>Followers
          </span>
          <span>
            <strong>4.9</strong>Rating
          </span>
          <span>
            <strong>86</strong>Products
          </span>
        </div>
        <button className="dark-button compact">Follow</button>
      </section>
      <section className="section">
        <div className="filter-tabs">
          <button className="active">Shop</button>
          <button>About</button>
          <button>Reviews</button>
        </div>
        <ProductGrid products={products.slice(0, 4)} />
      </section>
    </main>
  );
}
