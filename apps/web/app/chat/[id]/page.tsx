"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState, type FormEvent } from "react";

import "./thread.css";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../components/async-state";
import { Icon } from "../../components/icon";
import { conversationsApi } from "../../../lib/api/conversations";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const auth = useAuth();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversations = useRequest(
    () =>
      auth.isAuthenticated
        ? conversationsApi.list()
        : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const messages = useRequest(
    () =>
      auth.isAuthenticated
        ? conversationsApi.messages(id)
        : Promise.resolve({ data: [] }),
    [auth.isAuthenticated, id],
  );

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void messages.reload();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [auth.isAuthenticated, messages.reload]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.data.length]);

  const conversation = conversations.data?.data.find((item) => item.id === id);
  const isBuyer = conversation?.buyer.id === auth.user?.id;
  const otherName = conversation
    ? isBuyer
      ? conversation.seller.displayName
      : conversation.buyer.name
    : "Conversation";

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setSendError("");
    try {
      const response = await conversationsApi.send(id, body);
      messages.setData((current) => ({
        data: [...(current?.data ?? []), response.data],
      }));
      setDraft("");
      void conversations.reload();
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Unable to send message",
      );
    } finally {
      setSending(false);
    }
  };

  if (auth.loading)
    return (
      <ConversationShell title="Conversation">
        <LoadingState label="Loading conversation…" />
      </ConversationShell>
    );

  if (!auth.isAuthenticated)
    return (
      <ConversationShell title="Conversation">
        <SignInState
          message="Sign in to open this conversation."
          next={`/chat/${id}`}
        />
      </ConversationShell>
    );

  if (conversations.loading || messages.loading)
    return (
      <ConversationShell title={otherName}>
        <LoadingState label="Loading messages…" />
      </ConversationShell>
    );

  if (conversations.error || messages.error || !conversation)
    return (
      <ConversationShell title={otherName}>
        <ErrorState
          message={
            conversations.error ||
            messages.error ||
            "This conversation is unavailable."
          }
          retry={() => {
            void conversations.reload();
            void messages.reload();
          }}
        />
      </ConversationShell>
    );

  return (
    <main className="app-shell eazicart-thread-page">
      <ThreadHeader
        title={otherName}
        sellerId={isBuyer ? conversation.seller.id : undefined}
      />

      <section className="eazicart-thread-messages" aria-live="polite">
        {messages.data?.data.length ? (
          messages.data.data.map((message) => {
            const mine = message.senderId === auth.user?.id;
            return (
              <article
                className={`eazicart-message ${mine ? "is-mine" : "is-theirs"}`}
                key={message.id}
              >
                <p>{message.body}</p>
                <time dateTime={message.createdAt}>
                  {formatMessageTime(message.createdAt)}
                </time>
              </article>
            );
          })
        ) : (
          <div className="eazicart-thread-empty">
            <strong>Start the conversation</strong>
            <p>Ask about a product, delivery, stock or your order.</p>
          </div>
        )}
        <div ref={bottomRef} aria-hidden="true" />
      </section>

      <form className="eazicart-thread-composer" onSubmit={(event) => void send(event)}>
        {sendError ? (
          <p className="eazicart-thread-error" role="alert">
            {sendError}
          </p>
        ) : null}
        <div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Message ${otherName}`}
            aria-label={`Message ${otherName}`}
            maxLength={2000}
            rows={1}
          />
          <button type="submit" disabled={sending || !draft.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </main>
  );
}

function ConversationShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="app-shell eazicart-thread-page">
      <ThreadHeader title={title} />
      {children}
    </main>
  );
}

function ThreadHeader({ title, sellerId }: { title: string; sellerId?: string }) {
  return (
    <header className="eazicart-thread-header">
      <Link href="/chat" aria-label="Back to conversations">
        <Icon name="back" size={22} />
      </Link>
      <div>
        <strong>{title}</strong>
        <span>{sellerId ? "Seller" : "EaziCart chat"}</span>
      </div>
      {sellerId ? (
        <Link href={`/seller/${sellerId}`}>View store</Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </header>
  );
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
