"use client";
import Link from "next/link";
import { BottomNavigation } from "../components/bottom-navigation";
import { Header } from "../components/header";
import { Icon } from "../components/icon";
import { ProfileMenuItem } from "../components/profile-menu";
import { useAuth } from "../providers/auth-provider";
import { LoadingState, SignInState } from "../components/async-state";
export default function ProfilePage() {
  const auth = useAuth();
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
      {auth.loading ? (
        <LoadingState />
      ) : !auth.user ? (
        <SignInState message="Sign in to manage your EaziCart profile." />
      ) : (
        <>
          <section className="profile-head">
            <div className="profile-avatar">
              {auth.user.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2>{auth.user.name}</h2>
              <p>{auth.user.email}</p>
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
            <button className="secondary-button" onClick={auth.logout}>
              Log out
            </button>
          </section>
        </>
      )}
      <section className="profile-menu">
        <h3>Support</h3>
        <ProfileMenuItem href="/profile" icon="user" label="Help & support" />
        <ProfileMenuItem href="/profile" icon="box" label="About EaziCart" />
      </section>
      <BottomNavigation />
    </main>
  );
}
