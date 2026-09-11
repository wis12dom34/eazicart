import { Header } from "../components/header";
import { ProductGrid } from "../components/product-card";
import { products } from "../data";
export default function Saved() {
  return (
    <main className="app-shell">
      <Header title="Saved items" back="/profile" />
      <section className="section">
        <p className="page-intro">The pieces you love, all in one place.</p>
        <ProductGrid products={products.slice(0, 4)} />
      </section>
    </main>
  );
}
