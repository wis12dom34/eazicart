/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";

import "./chat.css";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { LoadingState, SignInState } from "../components/async-state";
import { useAuth } from "../providers/auth-provider";

export default function ChatPage() {
  const auth = useAuth();

  return (
    <main className="app-shell with-nav eazicart-chat-page">
      <header className="eazicart-chat-header">
        <div>
          <h1>Chat</h1>
          <p>Keep up with your seller conversations.</p>
        </div>
        <Link href="/explore#sellers" aria-label="Find sellers">
          <Icon name="search" size={21} />
        </Link>
      </header>

      {auth.loading ? (
        <LoadingState label="Loading chat…" />
      ) : !auth.isAuthenticated ? (
        <SignInState
          message="Sign in to view your seller conversations."
          next="/chat"
        />
      ) : (
        <section
          className="eazicart-chat-empty"
          aria-labelledby="chat-empty-title"
        >
          <span className="eazicart-chat-empty-icon" aria-hidden="true">
            <img src="/figma/nav-chat.svg" alt="" />
          </span>
          <h2 id="chat-empty-title">No conversations yet</h2>
          <p>
            Discover sellers and products you like. Your conversations will
            stay together here once messaging is connected.
          </p>
          <Link href="/explore#sellers">Explore sellers</Link>
        </section>
      )}

      <BottomNavigation activeHref="/chat" />
    </main>
  );
}
