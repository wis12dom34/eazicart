import Link from "next/link";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
export default function ReelsPage() {
  return (
    <main className="reels-page">
      <div className="reel-top">
        <strong>Reels</strong>
        <button aria-label="Search reels">
          <Icon name="search" />
        </button>
      </div>
      <div className="reel-content">
        <span className="reel-product">👜</span>
        <div className="reel-copy">
          <strong>@ariastudio</strong>
          <p>
            The bag that goes everywhere. Handwoven, practical, and made to
            last.
          </p>
          <Link href="/product/woven-tote">Shop Mini Woven Tote · ₦48,500</Link>
        </div>
        <div className="reel-actions">
          <button aria-label="Like">
            <Icon name="heart" />
          </button>
          <small>2.4k</small>
          <button aria-label="Save">
            <Icon name="bookmark" />
          </button>
        </div>
      </div>
      <BottomNavigation />
    </main>
  );
}
