import Link from "next/link";
import { Icon } from "./icon";
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <section className="state-card" role="status">
      <p>{label}</p>
    </section>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <section className="state-card error-state" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="secondary-button compact" onClick={retry}>
          Try again
        </button>
      )}
    </section>
  );
}
export function EmptyState({
  message,
  title,
  icon,
  action,
}: {
  message: string;
  title?: string;
  icon?: string;
  action?: { href: string; label: string };
}) {
  return (
    <section className={`state-card${title ? " rich-state" : ""}`}>
      {icon ? (
        <span className="state-icon">
          <Icon name={icon} size={24} />
        </span>
      ) : null}
      {title ? <h2>{title}</h2> : null}
      <p>{message}</p>
      {action ? (
        <Link className="state-action" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}
export function SignInState({
  message = "Sign in to view this page.",
}: {
  message?: string;
}) {
  return (
    <section className="state-card">
      <p>{message}</p>
      <Link className="dark-button compact" href="/login">
        Sign in
      </Link>
    </section>
  );
}
