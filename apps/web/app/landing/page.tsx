/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./landing.module.css";

const photos = {
  hero: "https://images.unsplash.com/photo-1761370571806-886404629697?auto=format&fit=crop&q=82&w=1600",
  market: "https://images.unsplash.com/photo-1734255026082-82fdc81991f0?auto=format&fit=crop&q=82&w=1400",
  seller: "https://images.unsplash.com/photo-1761370980657-22586ea44093?auto=format&fit=crop&q=82&w=1400",
  boutique: "https://images.unsplash.com/photo-1761370571873-5d869310d731?auto=format&fit=crop&q=82&w=1400",
  africa: "https://images.unsplash.com/photo-1734255287995-7c09dbc99613?auto=format&fit=crop&q=82&w=1400",
};

const businessTypes = [
  "Manufacturers",
  "Wholesalers",
  "Distributors",
  "Importers",
  "Retailers",
  "DTC Brands",
  "SMEs",
];

const products = [
  { name: "Oraimo Smart Watch", seller: "TechBridge · Lagos", price: "₦22,500 wholesale", tone: "orange" },
  { name: "Premium Hair Care", seller: "Belleza · Abuja", price: "₦9,800 wholesale", tone: "sand" },
  { name: "Rice 25kg", seller: "Prime Foods · Kano", price: "₦31,500 wholesale", tone: "green" },
  { name: "Commercial Blender", seller: "HomePro · Lagos", price: "₦48,000 wholesale", tone: "blue" },
];

const operatingFeatures = [
  ["Marketplace", "Discover products, brands and trusted suppliers."],
  ["Orders", "Track purchases and sales from one place."],
  ["Inventory", "Manage product availability and stock."],
  ["Customers", "Keep track of buyers and relationships."],
  ["Payments", "Handle business transactions securely."],
  ["Analytics", "Understand what is selling and where you are growing."],
  ["Logistics", "Track deliveries and fulfilment."],
  ["Business Profile", "Give your company a professional presence."],
];

const why = [
  ["Find opportunities", "Discover products and suppliers beyond your existing network."],
  ["Sell everywhere", "Turn your business profile into a digital sales channel."],
  ["Run smarter", "Manage orders, products and business activity from one dashboard."],
  ["Grow your network", "Build relationships with buyers, sellers and businesses."],
];

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className={styles.primaryButton} href={href}>
      {children}
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className={styles.secondaryButton} href={href}>
      {children}
    </Link>
  );
}

function ProductCard({
  name,
  seller,
  price,
  tone,
}: {
  name: string;
  seller: string;
  price: string;
  tone: string;
}) {
  return (
    <article className={styles.productCard}>
      <div className={`${styles.productArt} ${styles[`tone_${tone}`]}`}>
        <span className={styles.productOrb} />
        <span className={styles.productGlyph}>EC</span>
      </div>
      <strong>{name}</strong>
      <span>{seller}</span>
      <b>{price}</b>
    </article>
  );
}

function PhoneMockup({ title, orders = false }: { title: string; orders?: boolean }) {
  return (
    <div className={styles.phone}>
      <span className={styles.notch} />
      <h4>{title}</h4>
      {orders ? (
        <div className={styles.orderList}>
          {[
            ["Order #1042", "In transit · ₦86k"],
            ["Order #1038", "Delivered · ₦42k"],
            ["Order #1026", "Processing · ₦121k"],
            ["Order #1019", "Delivered · ₦28k"],
          ].map(([label, detail]) => (
            <div key={label} className={styles.phoneOrder}>
              <strong>{label}</strong>
              <span>{detail}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.phoneGrid}>
          {[
            ["Watch", "₦24.5k", "orange"],
            ["Beauty", "₦8.9k", "sand"],
            ["Rice", "₦31k", "green"],
            ["Blender", "₦19.8k", "blue"],
          ].map(([label, price, tone]) => (
            <div className={styles.phoneProduct} key={label}>
              <span className={`${styles.phoneProductArt} ${styles[`tone_${tone}`]}`}>EC</span>
              <strong>{label}</strong>
              <b>{price}</b>
            </div>
          ))}
        </div>
      )}
      <div className={styles.phoneNav}>
        <span className={title === "Home" ? styles.activeDot : ""}>●</span>
        <span>○</span>
        <span>○</span>
        <span>○</span>
        <span>○</span>
      </div>
    </div>
  );
}

export default function EaziCartLandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="EaziCart landing navigation">
          <Link href="/landing" className={styles.logo}>EaziCart</Link>
          <div className={styles.navLinks}>
            <a href="#product">Products</a>
            <a href="#marketplace">Marketplace</a>
            <a href="#solutions">Solutions</a>
            <a href="#businesses">For Businesses</a>
            <a href="#resources">Resources</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className={styles.navActions}>
            <Link className={styles.signIn} href="/login">Sign In</Link>
            <PrimaryLink href="/register">Get Started</PrimaryLink>
          </div>
        </nav>
      </header>

      <section className={`${styles.section} ${styles.hero}`}>
        <div className={`${styles.shell} ${styles.heroGrid}`}>
          <div className={`${styles.heroCopy} ${styles.reveal}`}>
            <h1>Commerce infrastructure for modern businesses.</h1>
            <p className={styles.lead}>
              Discover products, connect with suppliers, manage orders and grow
              your business from one powerful platform.
            </p>
            <div className={styles.buttonRow}>
              <PrimaryLink href="/register">Get Started Free</PrimaryLink>
              <SecondaryLink href="/explore">Explore EaziCart</SecondaryLink>
            </div>
            <p className={styles.microcopy}>
              Built for manufacturers, wholesalers, retailers, distributors and growing businesses.
            </p>
          </div>

          <div className={`${styles.heroVisual} ${styles.photoReveal}`}>
            <img src={photos.hero} alt="Shopkeeper in an Abuja retail store" />
            <div className={styles.photoWash} />
            <div className={styles.overviewCard}>
              <h3>Business overview</h3>
              <div className={styles.metrics}>
                <div><span>Revenue</span><strong>₦8.42M</strong></div>
                <div><span>Orders</span><strong>1,284</strong></div>
              </div>
              <ul>
                <li><span>Shoprite Lekki</span><b>₦245k</b></li>
                <li><span>Northstar Retail</span><b>₦118k</b></li>
                <li><span>Bela Beauty</span><b>₦84k</b></li>
              </ul>
            </div>
            <div className={styles.heroProduct}>
              <div className={`${styles.miniArt} ${styles.tone_orange}`}>EC</div>
              <strong>Wireless Headphones</strong>
              <span>Nova Electronics · Lagos</span>
              <b>₦18,500</b>
            </div>
            <div className={styles.supplierBadge}>
              <strong>Nova Electronics</strong>
              <span>Verified · Lagos</span>
            </div>
            <div className={styles.photoCaption}><i /> African retail · real commerce</div>
          </div>
        </div>
      </section>

      <section className={`${styles.proof} ${styles.sectionSoft}`}>
        <div className={`${styles.shell} ${styles.proofInner}`}>
          <p>Built for every layer of modern commerce</p>
          <div className={styles.pillRow}>
            {businessTypes.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
      </section>

      <section id="marketplace" className={styles.section}>
        <div className={`${styles.shell} ${styles.reveal}`}>
          <div className={styles.sectionHeading}>
            <h2>Discover what your business needs.</h2>
            <p>Find products, brands and verified sellers from one intelligent marketplace.</p>
          </div>
          <div className={styles.marketplacePanel}>
            <div className={styles.tabs}>
              <span className={styles.activeTab}>For You</span>
              <span>Trending</span>
              <span>Categories</span>
              <span>Brands</span>
              <span>Sellers</span>
            </div>
            <div className={styles.productGrid}>
              {products.map((product) => <ProductCard key={product.name} {...product} />)}
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionSoft}`}>
        <div className={`${styles.shell} ${styles.split} ${styles.reveal}`}>
          <div className={styles.splitCopy}>
            <h2>Your business deserves more than a storefront.</h2>
            <p>
              Create your business profile, showcase products, reach new buyers
              and manage operations from one place.
            </p>
            <PrimaryLink href="/register">Start Selling</PrimaryLink>
          </div>
          <div className={styles.sellerDashboard}>
            <img src={photos.market} alt="Nigerian market and local commerce" />
            <div className={styles.dashboardWash} />
            <div className={styles.dashboardContent}>
              <h3>Apex Distribution</h3>
              <div className={styles.metrics}>
                <div><span>Revenue</span><strong>₦12.8M</strong></div>
                <div><span>Orders</span><strong>2,418</strong></div>
              </div>
              <div className={styles.dashboardOrder}>
                <div><strong>Smart Watch x40</strong><span>Oct 4 · ₦900k</span></div>
                <b className={styles.statusDelivered}>Delivered</b>
              </div>
              <div className={styles.dashboardOrder}>
                <div><strong>Rice 25kg x20</strong><span>Oct 4 · ₦630k</span></div>
                <b>Processing</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="product" className={styles.section}>
        <div className={`${styles.shell} ${styles.reveal}`}>
          <div className={styles.sectionHeading}>
            <h2>One operating system for your entire business.</h2>
          </div>
          <div className={styles.featureGrid}>
            {operatingFeatures.map(([title, copy], index) => (
              <article className={styles.featureCard} key={title}>
                <span className={styles.featureIcon}>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionSoft}`}>
        <div className={`${styles.shell} ${styles.networkSection} ${styles.reveal}`}>
          <h2>Commerce works better when businesses are connected.</h2>
          <p>EaziCart connects the people who make, move and sell products across the economy.</p>
          <div className={styles.network}>
            {["Manufacturer", "Distributor", "Wholesaler", "Retailer", "Customer"].map((item, index) => (
              <div className={styles.networkPiece} key={item}>
                <div className={`${styles.networkNode} ${item === "Wholesaler" ? styles.networkActive : ""}`}>
                  <span />
                  <strong>{item}</strong>
                </div>
                {index < 4 ? <b className={styles.networkArrow}>→</b> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.shell} ${styles.mobileCommerce} ${styles.reveal}`}>
          <div className={styles.centerHeading}>
            <h2>Your business, in your pocket.</h2>
            <p>A social-commerce experience for discovery, buying, selling and order management.</p>
          </div>
          <div className={styles.phones}>
            <PhoneMockup title="Home" />
            <PhoneMockup title="Explore" />
            <PhoneMockup title="Orders" orders />
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionSoft}`}>
        <div className={`${styles.shell} ${styles.split} ${styles.reelsSection} ${styles.reveal}`}>
          <div className={styles.splitCopy}>
            <h2>Discover products the way people discover everything else.</h2>
            <p>
              Watch products, suppliers and brands through short-form business
              content built for commerce.
            </p>
          </div>
          <div className={styles.reelPhone}>
            <span className={styles.notch} />
            <h4>Reels</h4>
            <img src={photos.seller} alt="Market seller in Abuja" />
            <div className={styles.reelOverlay}>
              <span>Verified seller</span>
              <strong>Fresh products from Abuja</strong>
              <b>Shop now →</b>
            </div>
          </div>
        </div>
      </section>

      <section id="solutions" className={styles.section}>
        <div className={`${styles.shell} ${styles.reveal}`}>
          <div className={styles.sectionHeading}><h2>Why EaziCart</h2></div>
          <div className={styles.whyGrid}>
            {why.map(([title, copy], index) => (
              <article className={styles.featureCard} key={title}>
                <span className={styles.featureIcon}>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="businesses" className={`${styles.section} ${styles.sectionSoft}`}>
        <div className={`${styles.shell} ${styles.reveal}`}>
          <div className={styles.sectionHeading}>
            <h2>Built for the businesses that power commerce.</h2>
          </div>
          <div className={styles.businessSelector}>
            {["Manufacturers", "Wholesalers", "Distributors", "Retailers", "DTC Brands", "SMEs"].map((item, index) => (
              <span className={index === 0 ? styles.activeTab : ""} key={item}>{item}</span>
            ))}
          </div>
          <div className={styles.businessPanel}>
            <div>
              <h3>Manufacturers</h3>
              <p>Reach distributors, retailers and businesses looking for your products.</p>
            </div>
            <div className={styles.catalogue}>
              <ProductCard {...products[0]} />
              <ProductCard {...products[1]} />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.shell} ${styles.reveal}`}>
          <div className={styles.sectionHeading}><h2>Start in three steps.</h2></div>
          <div className={styles.steps}>
            {[
              ["01", "Create your business", "Set up your profile and tell EaziCart what your business does."],
              ["02", "Discover or sell", "Find suppliers and products or publish your catalogue."],
              ["03", "Grow", "Manage transactions, relationships and operations."],
            ].map(([number, title, copy]) => (
              <article key={number}>
                <b>{number}</b>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.storySection} ${styles.sectionSoft}`}>
        <div className={`${styles.shell} ${styles.quoteCard} ${styles.reveal}`}>
          <div>
            <blockquote>
              “EaziCart gives us one place to discover products, manage orders
              and connect with businesses.”
            </blockquote>
            <small>Editable testimonial placeholder</small>
            <p>Business Owner · Lagos, Nigeria</p>
          </div>
          <img src={photos.boutique} alt="Retail entrepreneur in an Abuja clothing store" />
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.shell} ${styles.split} ${styles.africaSection} ${styles.reveal}`}>
          <div className={styles.splitCopy}>
            <h2>Commerce infrastructure built for Africa. Designed to scale beyond it.</h2>
            <p>
              Millions of businesses still operate through fragmented tools,
              chats, spreadsheets and manual processes. EaziCart brings those workflows together.
            </p>
          </div>
          <div className={styles.africaGraphic}>
            <span className={styles.africaWord}>AFRICA</span>
            {[1,2,3,4,5,6,7,8].map((dot) => <i key={dot} className={styles[`dot${dot}`]} />)}
            <img src={photos.africa} alt="Nigerian market commerce" />
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionSoft} ${styles.finalCta}`}>
        <div className={`${styles.shell} ${styles.centerHeading} ${styles.reveal}`}>
          <h2>Your business should run better.</h2>
          <p>Join EaziCart and discover a better way to buy, sell and operate.</p>
          <div className={styles.buttonRow}>
            <PrimaryLink href="/register">Get Started Free</PrimaryLink>
            <SecondaryLink href="/explore">Explore Marketplace</SecondaryLink>
          </div>
        </div>
      </section>

      <footer id="resources" className={styles.footer}>
        <div className={styles.shell}>
          <h2>EaziCart</h2>
          <p>The Operating System for Modern Businesses.</p>
          <div className={styles.footerGrid}>
            <div><strong>Product</strong><span>Marketplace · Orders · Inventory · Payments</span></div>
            <div><strong>Solutions</strong><span>Manufacturers · Wholesalers · Retailers · SMEs</span></div>
            <div><strong>Company</strong><span>About · Careers · Contact</span></div>
            <div><strong>Resources</strong><span>Help Center · Blog · Developers</span></div>
          </div>
          <small>© EaziCart. All rights reserved. · Privacy · Terms · X · LinkedIn · Instagram</small>
        </div>
      </footer>
    </main>
  );
}
