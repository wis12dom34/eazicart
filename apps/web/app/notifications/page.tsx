"use client";
import { Header } from "../components/header";
import { Icon } from "../components/icon";
import { notificationsApi } from "../../lib/api/notifications";
import { useRequest } from "../hooks/use-request";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
export default function Notifications() {
  const auth = useAuth();
  const result = useRequest(
    async () =>
      auth.isAuthenticated
        ? notificationsApi.list()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const read = async (id: string) => {
    await notificationsApi.read(id);
    await result.reload();
  };
  const all = async () => {
    await notificationsApi.readAll();
    await result.reload();
  };
  return (
    <main className="app-shell">
      <Header
        title={`Notifications${result.data?.meta.unreadCount ? ` (${result.data.meta.unreadCount})` : ""}`}
        back="/profile"
        action={
          result.data?.meta.unreadCount ? (
            <button className="text-link" onClick={() => void all()}>
              Read all
            </button>
          ) : undefined
        }
      />
      {auth.loading || result.loading ? (
        <LoadingState />
      ) : !auth.isAuthenticated ? (
        <SignInState />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : !result.data?.data.length ? (
        <EmptyState message="You have no notifications." />
      ) : (
        <section className="notification-list">
          {result.data.data.map((n) => (
            <article
              key={n.id}
              className={n.readAt ? "" : "unread"}
              onClick={() => !n.readAt && void read(n.id)}
            >
              <span>
                <Icon name="bell" />
              </span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.message}</p>
              </div>
              <small>{new Date(n.createdAt).toLocaleDateString()}</small>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
