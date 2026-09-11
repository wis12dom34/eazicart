import { BrandMark } from "@eazicart/ui";

export default function HomePage() {
  return (
    <main className="landing">
      <nav className="navigation" aria-label="Primary navigation">
        <BrandMark className="brand" />
        <span className="status">Building for Nigeria</span>
      </nav>

      <section className="hero">
        <p className="eyebrow">Commerce, made social</p>
        <h1>Discover what’s next.<br />Shop it with ease.</h1>
        <p className="intro">
          EaziCart is a new home for discovering products, connecting with
          trusted sellers, and growing modern businesses.
        </p>
        <div className="coming-soon">
          <span className="pulse" aria-hidden="true" />
          The EaziCart experience is taking shape
        </div>
      </section>

      <footer>
        <span>Made for modern commerce</span>
        <span>© {new Date().getFullYear()} EaziCart</span>
      </footer>
    </main>
  );
}
