import Link from "next/link";

import { BottomNavigation } from "./components/bottom-navigation";
import { Header } from "./components/header";
import { Icon } from "./components/icon";
import { ProductGrid } from "./components/product-card";
import { products } from "./data";

const categories = [
  ["bag", "Bags"],
  ["shirt", "Fashion"],
  ["sparkle", "Beauty"],
  ["home", "Home"],
] as const;

export default function HomePage() {
  return (
    <main className="app-shell with-nav">
      <Header
        title="EaziCart"
        action={
          <Link
            className="icon-button"
            href="/notifications"
            aria-label="Notifications"
          >
            <Icon name="bell" />
          </Link>
        }
      />
      <section className="hero-card">
        <div>
          <p className="eyebrow">New season</p>
          <h1>
            Everyday pieces,
            <br />
            made exceptional.
          </h1>
          <Link className="dark-button compact" href="/explore">
            Shop collection
          </Link>
        </div>
        <div className="hero-orb" aria-hidden="true">
          EC
        </div>
      </section>
      <section className="section">
        <div className="section-header">
          <h2>Shop by category</h2>
          <Link href="/explore">See all</Link>
        </div>
        <div className="category-row">
          {categories.map(([icon, label]) => (
            <Link
              className="category-pill"
              href={`/explore?category=${label}`}
              key={label}
            >
              <span>
                <Icon name={icon} />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="section-header">
          <h2>Trending now</h2>
          <Link href="/explore">View all</Link>
        </div>
        <ProductGrid products={products.slice(0, 4)} />
      </section>
      <BottomNavigation />
    </main>
  );
}
