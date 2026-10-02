/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Product } from "../lib/api/types";
import { homeDesignProducts } from "./home-design";
import { money } from "./data";
const promos = [
  {
    tag: "TECH PICKS",
    title: "Discover standout tech",
    description: "Shop trending devices and verified sellers",
    cta: "Explore",
    image: "iphone-15-pro.jpg",
    gradient: "rgba(8,102,245,.82), rgba(111,75,255,.82)",
    href: "/explore",
    color: "#0866f5",
  },
  {
    tag: "TRENDING",
    title: "Popular around you",
    description: "See what shoppers are viewing nearby",
    cta: "See trends",
    image: "nike-air-max-90.jpg",
    gradient: "rgba(255,122,0,.82), rgba(255,59,107,.82)",
    href: null,
    color: "#ff7a00",
  },
  {
    tag: "TRUSTED STORES",
    title: "Shop verified sellers",
    description: "Discover trusted brands and active stores",
    cta: "Browse sellers",
    image: "macbook-air-m4.png",
    gradient: "rgba(0,168,107,.82), rgba(0,184,217,.82)",
    href: null,
    color: "#00a86b",
  },
];
const flash = [
  {
    name: 'Hisense 55" 4K TV',
    badge: "-10%",
    previous: "690000",
    gradient: "#dff7ff, #e8e4ff",
    color: "#ff3b30",
  },
  {
    name: "PS5 Slim Console",
    badge: "-9%",
    previous: "1080000",
    gradient: "#eee7ff, #ffe6f1",
    color: "#8b5cf6",
  },
  {
    name: "MacBook Air M4",
    badge: "HOT",
    previous: null,
    gradient: "#fff1d8, #ffe7d0",
    color: "#ff7a00",
  },
];
const reels = [
  {
    name: "Nike Air Max 90",
    title: "Fresh kicks",
    seller: "Nike Official",
    views: "12.4K",
  },
  {
    name: "iPhone 15 Pro",
    title: "Tech drop",
    seller: "Jumia Nigeria",
    views: "9.8K",
  },
  {
    name: "Adidas Samba OG",
    title: "Street style",
    seller: "Adidas Official",
    views: "7.3K",
  },
];
const topSellers = [
  ["Nike Official", "N", "@nikeofficial · Fashion"],
  ["Jumia Nigeria", "J", "@jumianigeria · Marketplace"],
  ["Samsung Store", "S", "@samsungstore · Electronics"],
];
const brands = [
  ["Nike", "N", "2.1M"],
  ["Apple", "A", "3.8M"],
  ["Samsung", "S", "2.9M"],
  ["Adidas", "ad", "1.7M"],
  ["Hisense", "H", "842K"],
];
export function HomeSections({ products }: { products: Product[] }) {
  return (
    <>
      <section className="figma-home-promos" aria-label="Featured collections">
        <div className="figma-home-promo-strip">
          {promos.map((p) => {
            const body = (
              <>
                <img
                  className="figma-home-promo-image"
                  src={`/figma/${p.image}`}
                  alt=""
                />
                <div
                  className="figma-home-promo-gradient"
                  style={{
                    backgroundImage: `linear-gradient(136.838deg, ${p.gradient})`,
                  }}
                />
                <i className="figma-home-orb-large" />
                <i className="figma-home-orb-small" />
                <span className="figma-home-promo-tag">{p.tag}</span>
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <b style={{ color: p.color }}>{p.cta}</b>
              </>
            );
            return p.href ? (
              <Link className="figma-home-promo" href={p.href} key={p.tag}>
                {body}
              </Link>
            ) : (
              <div
                className="figma-home-promo"
                key={p.tag}
                aria-label={`${p.title}: collection unavailable`}
              >
                {body}
              </div>
            );
          })}
        </div>
        <div className="figma-home-promo-pagination" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>
      <section className="figma-home-flash">
        <div className="figma-home-section-header">
          <h2>
            Flash sale{" "}
            <span className="figma-home-timer">
              <img
                src="/figma/flash-timer.png"
                alt="02:14:33"
                width={69}
                height={18}
              />
            </span>
          </h2>
          <span>View all</span>
        </div>
        <div className="figma-home-flash-strip">
          {flash.map((f) => {
            const design = homeDesignProducts.find((p) => p.name === f.name);
            const product = products.find(
              (p) =>
                p.name === f.name && p.seller.displayName === design?.seller,
            );
            return product && design ? (
              <Link
                className="figma-home-flash-card"
                href={`/product/${product.id}`}
                key={f.name}
              >
                <div
                  style={{
                    backgroundImage: `linear-gradient(124.0714deg, ${f.gradient})`,
                  }}
                >
                  <img src={`/figma/${design.image}`} alt={f.name} />
                  <span style={{ background: f.color }}>{f.badge}</span>
                </div>
                <strong>{f.name}</strong>
                <b>{money(product.price)}</b>
                {f.previous ? <small>Was {money(f.previous)}</small> : null}
              </Link>
            ) : null;
          })}
        </div>
      </section>
      <div className="figma-home-lower-divider" />
      <section className="figma-home-reels">
        <div className="figma-home-section-header">
          <h2>Reels for you</h2>
          <Link href="/reels">View all →</Link>
        </div>
        <div className="figma-home-reel-strip">
          {reels.map((reel) => {
            const product = products.find(
              (p) =>
                p.name === reel.name && p.seller.displayName === reel.seller,
            );
            const design = homeDesignProducts.find((p) => p.name === reel.name);
            return product && design ? (
              <Link
                className="figma-home-reel"
                href={`/reels?productId=${encodeURIComponent(product.id)}`}
                key={reel.name}
              >
                <img
                  className="figma-home-reel-cover"
                  src={`/figma/${design.image}`}
                  alt=""
                />
                <div className="figma-home-reel-gradient" />
                <img
                  className="figma-home-reel-play"
                  src="/figma/reel-play.svg"
                  width={28}
                  height={28}
                  alt=""
                />
                <div className="figma-home-reel-copy">
                  <strong>{reel.title}</strong>
                  <span>{reel.seller}</span>
                  <small>{reel.views} views</small>
                </div>
              </Link>
            ) : null;
          })}
        </div>
      </section>
      <div className="figma-home-lower-divider" />
      <section className="figma-home-top-sellers">
        <div className="figma-home-section-header">
          <h2>Top sellers</h2>
          <span>Show more</span>
        </div>
        {topSellers.map(([name, initial, subtitle]) => {
          const seller = products.find(
            (p) => p.seller.displayName === name,
          )?.seller;
          const body = (
            <>
              <b className="figma-home-seller-initial">{initial}</b>
              <div>
                <strong>
                  {name}
                  <b className="figma-home-verification">✓</b>
                </strong>
                <p>{subtitle}</p>
              </div>
            </>
          );
          return seller ? (
            <Link
              className="figma-home-top-seller"
              href={`/seller/${seller.id}`}
              key={name}
            >
              {body}
            </Link>
          ) : (
            <div className="figma-home-top-seller" key={name}>
              {body}
            </div>
          );
        })}
      </section>
      <div className="figma-home-lower-divider" />
      <section className="figma-home-brands">
        <div className="figma-home-section-header">
          <h2>Brands to follow</h2>
          <span>Browse</span>
        </div>
        <div className="figma-home-brand-strip">
          {brands.map(([name, initial, count]) => (
            <div className="figma-home-brand" key={name}>
              <b>{initial}</b>
              <strong>{name}</strong>
              <small>{count}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
