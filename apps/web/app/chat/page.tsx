"use client";

import Link from "next/link";

import "./chat.css";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";

export default function ChatPage() {
  return (
    <main className="app-shell with-nav eazicart-chat-page">
      <header className="eazicart-chat-header">
        <div>
          <h1>Chat</h1>
          <p>Messages from sellers will appear here.</p>
        </div>
        <Link href="/explore#sellers" aria-label="Find sellers">
          <Icon name="search" size={21} />
        </Link>
      </header>

      <section className="eazicart-chat-empty" aria-labelledby="chat-empty-title">
        <span className="eazicart-chat-empty-icon" aria-hidden="true">
          <Icon name="chat" size={28} />
        </span>
        <h2 id="chat-empty-title">No conversations yet</h2>
        <p>
          Open a seller store or product to start a conversation when messaging is available.
        </p>
        <Link href="/explore#sellers">Explore sellers</Link>
      </section>

      <BottomNavigation />
    </main>
  );
}
