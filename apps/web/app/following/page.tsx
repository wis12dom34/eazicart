import Link from "next/link";
import { Header } from "../components/header";
import { sellers } from "../data";
export default function Following() {
  return (
    <main className="app-shell">
      <Header title="Following" back="/profile" />
      <section className="following-list">
        {sellers.map((s) => (
          <article key={s.id}>
            <Link href={`/seller/${s.id}`} className="seller-avatar small">
              {s.initials}
            </Link>
            <div>
              <strong>{s.name}</strong>
              <small>
                {s.handle} · {s.followers} followers
              </small>
            </div>
            <button className="secondary-button small-button">Following</button>
          </article>
        ))}
      </section>
    </main>
  );
}
