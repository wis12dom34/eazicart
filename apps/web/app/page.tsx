type IconName = "home" | "search" | "reels" | "bag" | "user" | "bell";

function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M3 10.7 12 3l9 7.7V21h-6v-6H9v6H3V10.7Z" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m16.2 16.2 4.3 4.3" />
      </svg>
    );
  }

  if (name === "reels") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="m10 8 6 4-6 4V8Z" />
      </svg>
    );
  }

  if (name === "bag") {
    return (
      <svg {...common}>
        <path d="M5 8h14l-1 13H6L5 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg {...common}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

const categories = ["For You", "Phones", "Fashion", "Home & Living", "Beauty", "Groceries"];

const sellers = [
  {
    name: "Nike Official",
    tagline: "Move Better. Live Better.",
    products: [
      { badge: "New", name: "Nike Air Max 90", price: "₦125,000" },
      { badge: "Bestseller", name: "Nike Club Hoodie", price: "₦78,000" },
    ],
  },
  {
    name: "Jumia Nigeria",
    tagline: "Everything you need, delivered fast.",
    products: [
      { badge: "-20%", name: "iPhone 15", price: "₦1,250,000" },
      { badge: "Bestseller", name: "AirPods Pro (2nd Gen)", price: "₦320,000" },
    ],
  },
];

const navItems: Array<{ label: string; icon: IconName }> = [
  { label: "Home", icon: "home" },
  { label: "Explore", icon: "search" },
  { label: "Reels", icon: "reels" },
  { label: "Orders", icon: "bag" },
  { label: "Profile", icon: "user" },
];

function ProductCard({ badge, name, price }: { badge: string; name: string; price: string }) {
  return (
    <article className="product-card">
      <div className="product-media">
        <span>{badge}</span>
      </div>
      <div className="product-info">
        <h3>{name}</h3>
        <p>{price}</p>
        <button type="button">Add to Cart</button>
      </div>
    </article>
  );
}

export default function HomePage() {
  return (
    <main className="customer-shell">
      <div className="phone-canvas">
        <header className="app-header">
          <div className="avatar" aria-label="User profile" />
          <div className="eazicart-mark" aria-label="EaziCart">
            <svg viewBox="0 0 34 34" aria-hidden="true">
              <path d="M5 9h4l2.5 11h11.7l3-8H11" />
              <path d="M14 15h9" />
              <circle cx="14" cy="25" r="1.8" />
              <path d="M18 25c5.5-1 9.2-4 11-8" />
              <path d="m25 15 4 2 1-4" />
            </svg>
          </div>
          <div className="header-actions">
            <button type="button" aria-label="Notifications">
              <Icon name="bell" size={20} />
            </button>
            <button type="button" aria-label="Cart">
              <Icon name="bag" size={20} />
            </button>
          </div>
        </header>

        <button className="search-box" type="button">
          <Icon name="search" size={15} />
          <span>Search products, brands and more...</span>
        </button>

        <nav className="category-strip" aria-label="Product categories">
          {categories.map((category, index) => (
            <button className={index === 0 ? "active" : ""} type="button" key={category}>
              <span className="category-icon" aria-hidden="true" />
              <span>{category}</span>
            </button>
          ))}
        </nav>

        <section className="feed" aria-label="For you product feed">
          {sellers.map((seller) => (
            <div className="seller-section" key={seller.name}>
              <div className="seller-row">
                <div className="seller-avatar" aria-hidden="true" />
                <div className="seller-copy">
                  <h2>
                    {seller.name} <span aria-label="Verified">✓</span>
                  </h2>
                  <p>{seller.tagline}</p>
                </div>
                <button className="follow-button" type="button">
                  Follow
                </button>
              </div>

              <div className="product-grid">
                {seller.products.map((product) => (
                  <ProductCard key={product.name} {...product} />
                ))}
              </div>
            </div>
          ))}
        </section>

        <div className="scroll-clearance" aria-hidden="true" />

        <nav className="bottom-navigation" aria-label="Primary navigation">
          {navItems.map((item, index) => (
            <button className={index === 0 ? "active" : ""} type="button" key={item.label}>
              <Icon name={item.icon} size={24} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
