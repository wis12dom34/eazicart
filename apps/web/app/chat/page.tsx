"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import "./chat.css";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { ProfileAvatar } from "../components/profile-avatar";
import { ErrorState, LoadingState } from "../components/async-state";
import { sellersApi } from "../../lib/api/sellers";
import type { Seller } from "../../lib/api/types";

const sellersHref = "/explore?section=sellers";

export default function ChatPage() {
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const id = new URLSearchParams(window.location.search).get("seller");
    setSellerId(id);
    setLoading(true);
    setError("");

    const request = id ? sellersApi.get(id) : sellersApi.list();
    void request
      .then((response) => {
        if (!active) return;
        if ("data" in response) {
          if (Array.isArray(response.data)) setSellers(response.data);
          else setSelectedSeller(response.data);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load chat",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (sellerId) {
    return (
      <main
        className="app-shell with-nav eazicart-chat-page eazicart-chat-conversation"
        data-figma-node="62:2"
      >
        {loading ? (
          <div className="eazicart-chat-loading">
            <LoadingState label="Loading conversation…" />
          </div>
        ) : error || !selectedSeller ? (
          <div className="eazicart-chat-loading">
            <ErrorState message={error || "Seller not found"} />
            <Link className="eazicart-chat-return" href="/chat">
              Back to Chat
            </Link>
          </div>
        ) : (
          <>
            <header className="eazicart-chat-conversation-header">
              <Link
                className="eazicart-chat-back"
                href="/chat"
                aria-label="Back to chats"
              >
                <Icon name="back" size={24} />
              </Link>
              <Link
                className="eazicart-chat-store-avatar"
                href={`/seller/${selectedSeller.id}`}
                aria-label={`View ${selectedSeller.displayName}`}
              >
                <ProfileAvatar
                  userId={selectedSeller.userId}
                  name={selectedSeller.displayName}
                />
              </Link>
              <Link
                className="eazicart-chat-store-copy"
                href={`/seller/${selectedSeller.id}`}
              >
                <strong>{selectedSeller.displayName}</strong>
                <span>Seller</span>
              </Link>
              <Link
                className="eazicart-chat-store-link"
                href={`/seller/${selectedSeller.id}`}
                aria-label={`Open ${selectedSeller.displayName} store`}
              >
                <Icon name="store" size={21} />
              </Link>
            </header>

            <section
              className="eazicart-chat-thread"
              aria-label={`Conversation with ${selectedSeller.displayName}`}
            >
              <span className="eazicart-chat-date">Today</span>
              <div className="eazicart-chat-start">
                <span className="eazicart-chat-start-avatar" aria-hidden="true">
                  <ProfileAvatar
                    userId={selectedSeller.userId}
                    name={selectedSeller.displayName}
                  />
                </span>
                <h1>{selectedSeller.displayName}</h1>
                <p>
                  No messages yet. When messaging is connected, your
                  conversation with this store will stay here.
                </p>
                <Link href={`/seller/${selectedSeller.id}`}>View store</Link>
              </div>
            </section>

            <div
              className="eazicart-chat-composer"
              aria-label="Message composer"
            >
              <input
                type="text"
                placeholder="Write a message…"
                aria-label="Write a message"
                disabled
              />
              <button
                type="button"
                aria-label="Messaging is not available yet"
                disabled
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="m5 12 14-7-5 14-2.7-5.3L5 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </>
        )}

        <BottomNavigation activeHref="/chat" />
      </main>
    );
  }

  return (
    <main className="app-shell with-nav eazicart-chat-page">
      <header className="eazicart-chat-header">
        <div>
          <h1>Chat</h1>
          <p>Message stores you discover on EaziCart.</p>
        </div>
        <Link href={sellersHref} aria-label="Find sellers">
          <Icon name="search" size={21} />
        </Link>
      </header>

      <section className="eazicart-chat-inbox" aria-labelledby="chat-title">
        <div className="eazicart-chat-inbox-heading">
          <h2 id="chat-title">Stores</h2>
          <Link href={sellersHref}>Explore</Link>
        </div>

        {loading ? (
          <LoadingState label="Loading stores…" />
        ) : error ? (
          <ErrorState message={error} />
        ) : sellers.length ? (
          <div className="eazicart-chat-seller-list">
            {sellers.map((seller) => (
              <Link
                key={seller.id}
                className="eazicart-chat-seller-row"
                href={`/chat?seller=${encodeURIComponent(seller.id)}`}
              >
                <span className="eazicart-chat-seller-avatar" aria-hidden="true">
                  <ProfileAvatar
                    userId={seller.userId}
                    name={seller.displayName}
                  />
                </span>
                <span className="eazicart-chat-seller-text">
                  <strong>{seller.displayName}</strong>
                  <small>{seller.bio || "Open store conversation"}</small>
                </span>
                <Icon name="chevron" size={18} />
              </Link>
            ))}
          </div>
        ) : (
          <section
            className="eazicart-chat-empty"
            aria-labelledby="chat-empty-title"
          >
            <span className="eazicart-chat-empty-icon" aria-hidden="true">
              <Icon name="chat" size={28} />
            </span>
            <h2 id="chat-empty-title">No stores to message yet</h2>
            <p>Discover a store first, then open Chat from its profile.</p>
            <Link href={sellersHref}>Explore sellers</Link>
          </section>
        )}
      </section>

      <BottomNavigation activeHref="/chat" />
    </main>
  );
}
