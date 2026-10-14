import Link from "next/link";
import { Icon, type IconName } from "./icon";
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <section className="state-card loading-state" role="status">
      <span className="loading-indicator" aria-hidden="true" />
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
    <section
      className={`state-card error-state${retry ? " recoverable-error" : ""}`}
      role="alert"
    >
      <span className="state-icon" aria-hidden="true">
        <Icon name="error" size={36} />
      </span>
      {retry ? <h2>Something went wrong</h2> : null}
      <p>{message}</p>
      {retry && (
        <button className="error-retry" type="button" onClick={retry}>
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
  icon?: IconName;
  action?: { href: string; label: string };
}) {
  return (
    <section className={`state-card${title ? " rich-state" : ""}`}>
      {icon ? (
        <span className="state-icon" aria-hidden="true">
          <Icon name={icon} size={36} />
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
