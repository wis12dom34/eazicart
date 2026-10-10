import Link from "next/link";
import { Icon } from "./icon";
import styles from "./seller-bottom-navigation.module.css";

type SellerNavItem = "home" | "products" | "orders" | "storefront" | "profile";

const items: Array<{
  key: SellerNavItem;
  label: string;
  href: string;
  icon: string;
}> = [
  { key: "home", label: "Home", href: "/seller/dashboard", icon: "home" },
  { key: "products", label: "Products", href: "/seller/products", icon: "box" },
  { key: "orders", label: "Orders", href: "/seller/orders", icon: "bag" },
  { key: "storefront", label: "Storefront", href: "/seller/store", icon: "shirt" },
  { key: "profile", label: "Profile", href: "/profile", icon: "user" },
];

export function SellerBottomNavigation({ active }: { active?: SellerNavItem }) {
  return (
    <nav className={styles.nav} aria-label="Seller navigation">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            className={isActive ? styles.active : undefined}
            href={item.href}
            key={item.key}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={styles.icon}>
              <Icon name={item.icon} size={20} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
