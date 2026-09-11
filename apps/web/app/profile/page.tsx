import Link from "next/link";
import { BottomNavigation } from "../components/bottom-navigation";
import { Header } from "../components/header";
import { Icon } from "../components/icon";
import { ProfileMenuItem } from "../components/profile-menu";
export default function ProfilePage() {
  return (
    <main className="app-shell with-nav">
      <Header
        title="Profile"
        action={
          <Link href="/edit-profile" className="text-link">
            Edit
          </Link>
        }
      />
      <section className="profile-head">
        <div className="profile-avatar">AO</div>
        <div>
          <h2>Amara Okafor</h2>
          <p>amara@example.com</p>
        </div>
      </section>
      <div className="profile-quick">
        <Link href="/orders">
          <Icon name="bag" />
          <strong>Orders</strong>
        </Link>
        <Link href="/saved">
          <Icon name="heart" />
          <strong>Saved</strong>
        </Link>
        <Link href="/following">
          <Icon name="users" />
          <strong>Following</strong>
        </Link>
      </div>
      <section className="profile-menu">
        <h3>Account</h3>
        <ProfileMenuItem
          href="/address-book"
          icon="location"
          label="Address book"
        />
        <ProfileMenuItem
          href="/payment-methods"
          icon="card"
          label="Payment methods"
        />
        <ProfileMenuItem
          href="/notifications"
          icon="bell"
          label="Notifications"
          detail="Manage your updates"
        />
      </section>
      <section className="profile-menu">
        <h3>Support</h3>
        <ProfileMenuItem href="/profile" icon="user" label="Help & support" />
        <ProfileMenuItem href="/profile" icon="box" label="About EaziCart" />
      </section>
      <BottomNavigation />
    </main>
  );
}
