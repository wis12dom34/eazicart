/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";

import "./chat.css";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { conversationsApi } from "../../lib/api/conversations";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";

export default function ChatPage() {
  const auth = useAuth();
  const conversations = useRequest(
    () =>
      auth.isAuthenticated
        ? conversationsApi.list()
        : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );

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

      {auth.loading || conversations.loading ? (
        <LoadingState label="Loading conversations…" />
      ) : !auth.isAuthenticated ? (
        <SignInState
          message="Sign in to view your seller conversations."
          next="/chat"
        />
      ) : conversations.error ? (
        <ErrorState
          message={conversations.error}
          retry={() => void conversations.reload()}
        />
      ) : conversations.data?.data.length ? (
        <section
          className="eazicart-chat-list"
          aria-label="Seller conversations"
        >
          {conversations.data.data.map((conversation) => {
            const isBuyer = conversation.buyer.id === auth.user?.id;
            const name = isBuyer
              ? conversation.seller.displayName
              : conversation.buyer.name;
            const lastMessage = conversation.messages[0];

            return (
              <Link
                className="eazicart-chat-row"
                href={`/chat/${conversation.id}`}
                key={conversation.id}
              >
                <span className="eazicart-chat-avatar" aria-hidden="true">
                  {initials(name)}
                </span>
                <span className="eazicart-chat-row-copy">
                  <span className="eazicart-chat-row-heading">
                    <strong>{name}</strong>
                    <time dateTime={conversation.updatedAt}>
                      {formatConversationTime(conversation.updatedAt)}
                    </time>
                  </span>
                  <span className="eazicart-chat-preview">
                    {lastMessage?.body ?? "Start the conversation"}
                  </span>
                </span>
              </Link>
            );
          })}
        </section>
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
            Open a seller profile and tap Message. Your conversations will stay
            together here.
          </p>
          <Link href="/explore#sellers">Explore sellers</Link>
        </section>
      )}

      <BottomNavigation activeHref="/chat" />
    </main>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  return new Intl.DateTimeFormat("en-NG", sameDay
    ? { hour: "numeric", minute: "2-digit" }
    : { day: "numeric", month: "short" }).format(date);
}
