/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import "./chat.css";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { ProfileAvatar } from "../components/profile-avatar";
import { ErrorState, LoadingState } from "../components/async-state";
import { sellersApi } from "../../lib/api/sellers";
import type { Seller } from "../../lib/api/types";

const sellersHref = "/explore?section=sellers";

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <main className="app-shell with-nav eazicart-chat-page">
          <LoadingState label="Loading chat…" />
          <BottomNavigation activeHref="/chat" />
        </main>
      }
    >
      <ChatScreen />
    </Suspense>
  );
}

function ChatScreen() {
  const sellerId = useSearchParams().get("seller");
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const retry = () => setRetryVersion((current) => current + 1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSelectedSeller(null);

    const request = sellerId ? sellersApi.get(sellerId) : sellersApi.list();
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
  }, [sellerId, retryVersion]);

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
            <ErrorState message={error || "Seller not found"} retry={retry} />
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
                <Icon name="back" size={22} />
              </Link>
              <Link
                className="eazicart-chat-store-avatar"
                href={`/seller/${selectedSeller.id}`}
                aria-label={`View ${selectedSeller.displayName}`}
              >
                <span>
                  <ProfileAvatar
                    userId={selectedSeller.userId}
                    name={selectedSeller.displayName}
                  />
                </span>
              </Link>
              <Link
                className="eazicart-chat-store-copy"
                href={`/seller/${selectedSeller.id}`}
              >
                <strong>{selectedSeller.displayName}</strong>
                <span>Seller</span>
              </Link>
            </header>

            <section
              className="eazicart-chat-thread"
              aria-label={`Conversation with ${selectedSeller.displayName}`}
            >
              <div className="eazicart-chat-start">
                <span className="eazicart-chat-start-avatar" aria-hidden="true">
                  <ProfileAvatar
                    userId={selectedSeller.userId}
                    name={selectedSeller.displayName}
                  />
                </span>
                <h1>{selectedSeller.displayName}</h1>
                <p>
                  No messages yet. Messaging with this store is not available
                  yet.
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
                placeholder="Message seller..."
                aria-label="Message seller"
                disabled
              />
              <button
                type="button"
                aria-label="Messaging is not available yet"
                disabled
              >
                <Icon name="send" size={18} />
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
          <ErrorState message={error} retry={retry} />
        ) : sellers.length ? (
          <div className="eazicart-chat-seller-list">
            {sellers.map((seller) => (
              <Link
                key={seller.id}
                className="eazicart-chat-seller-row"
                href={`/chat?seller=${encodeURIComponent(seller.id)}`}
              >
                <span
                  className="eazicart-chat-seller-avatar"
                  aria-hidden="true"
                >
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
              <Icon name="chat" size={36} />
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
