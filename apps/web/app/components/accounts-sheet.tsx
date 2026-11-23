"use client";

import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../lib/api/client";
import { browserAuth, enrollBrowserAccount } from "../../lib/api/auth";
import {
  announceAccountChange,
  reloadForAccountChange,
} from "../../lib/api/account-change";
import type { User } from "../../lib/api/types";
import styles from "./accounts-sheet.module.css";

export function AccountsSheet() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [accounts, setAccounts] = useState<User[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update accounts",
      );
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    try {
      const result = await browserAuth.accounts();
      setAccounts(result.accounts);
      setActive(result.activeUserId);
      setAdding(result.accounts.length === 0);
    } catch (caught) {
      if (
        !(caught instanceof ApiError) ||
        caught.code !== "DEVICE_SESSION_EXPIRED"
      )
        throw caught;
      setAccounts([]);
      setActive(null);
      setAdding(true);
    }
  }

  function changed(destination: string) {
    announceAccountChange();
    reloadForAccountChange(destination);
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      await enrollBrowserAccount(
        String(data.get("email")),
        String(data.get("password")),
      );
      changed("/profile");
    });
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          dialog.current?.showModal();
          void run(load);
        }}
      >
        Accounts
      </button>
      <dialog
        ref={dialog}
        className={styles.sheet}
        aria-labelledby="accounts-title"
      >
        <header className={styles.header}>
          <h2 id="accounts-title">Accounts</h2>
          <button type="button" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </header>
        {error && <p role="alert">{error}</p>}
        {busy && <p role="status">Updating accounts…</p>}
        <ul className={styles.list}>
          {accounts.map((account) => (
            <li key={account.id}>
              <button
                type="button"
                className={styles.identity}
                disabled={busy || active === account.id}
                onClick={() =>
                  void run(async () => {
                    await browserAuth.switch(account.id);
                    changed("/profile");
                  })
                }
              >
                <span aria-hidden="true" className={styles.avatar}>
                  {account.name.slice(0, 1).toUpperCase()}
                </span>
                <span className={styles.details}>
                  <strong>{account.name}</strong>
                  <span>
                    {account.username ? `@${account.username}` : account.email}
                  </span>
                </span>
                {active === account.id && <span>Active</span>}
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={`Remove ${account.name}`}
                onClick={() =>
                  void run(async () => {
                    await browserAuth.remove(account.id);
                    if (account.id === active) changed("/login");
                    else await load();
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        {adding ? (
          <form className={styles.form} onSubmit={add}>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              Sign in and add account
            </button>
          </form>
        ) : (
          <button type="button" disabled={busy} onClick={() => setAdding(true)}>
            Add account
          </button>
        )}
        {accounts.length > 0 && (
          <button
            type="button"
            className={styles.logout}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await browserAuth.logoutAll();
                changed("/login");
              })
            }
          >
            Log out of all accounts
          </button>
        )}
      </dialog>
    </>
  );
}
