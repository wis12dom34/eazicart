import Link from "next/link";
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
export function EmptyState({ message }: { message: string }) {
  return (
    <section className="state-card">
      <p>{message}</p>
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
