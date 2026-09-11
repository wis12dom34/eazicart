import Link from "next/link";
import { BottomNavigation } from "../components/bottom-navigation";
import { Header } from "../components/header";
import { Icon } from "../components/icon";
import { ProductGrid } from "../components/product-card";
import { products, sellers } from "../data";
export default function ExplorePage() {
  return (
    <main className="app-shell with-nav">
      <Header title="Explore" />
      <label className="search-bar">
        <Icon name="search" size={20} />
        <input
          aria-label="Search products, brands and sellers"
          placeholder="Search products, brands and sellers"
        />
        <button aria-label="Filter">
          <Icon name="filter" size={20} />
        </button>
      </label>
      <div className="filter-tabs">
        <button className="active">Products</button>
        <Link href="#categories">Categories</Link>
        <Link href="#brands">Brands</Link>
        <Link href="#sellers">Sellers</Link>
      </div>
      <section className="section" id="categories">
        <div className="section-header">
          <h2>Browse categories</h2>
        </div>
        <div className="wide-cards">
          {["Women", "Men", "Accessories", "Home & living"].map((x, i) => (
            <Link
              href={`?category=${x}`}
              className="wide-card"
              key={x}
              style={{
                background: ["#e9ddd4", "#dce1df", "#e6e0d5", "#d8dfdc"][i],
              }}
            >
              {x}
              <Icon name="chevron" size={18} />
            </Link>
          ))}
        </div>
      </section>
      <section className="section" id="brands">
        <div className="section-header">
          <h2>Featured brands</h2>
          <Link href="#sellers">See all</Link>
        </div>
        <div className="seller-row">
          {sellers.map((s) => (
            <Link href={`/seller/${s.id}`} className="seller-chip" key={s.id}>
              <span>{s.initials}</span>
              <strong>{s.name}</strong>
              <small>{s.followers} followers</small>
            </Link>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-header">
          <h2>Popular picks</h2>
        </div>
        <ProductGrid products={products} />
      </section>
      <BottomNavigation />
    </main>
  );
}
