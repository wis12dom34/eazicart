"use client";
import { useState, type FormEvent } from "react";
import { Header } from "../components/header";
import { Icon } from "../components/icon";
import { addressesApi } from "../../lib/api/addresses";
import { useRequest } from "../hooks/use-request";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { useAuth } from "../providers/auth-provider";

const formString = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

export default function AddressBook() {
  const auth = useAuth();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const result = useRequest(
    async () =>
      auth.isAuthenticated ? addressesApi.list() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await addressesApi.create({
        label: formString(f, "label"),
        line1: formString(f, "line1"),
        city: formString(f, "city"),
        region: formString(f, "region"),
        postalCode: formString(f, "postalCode"),
        country: formString(f, "country"),
        isDefault: f.get("isDefault") === "on",
      });
      setAdding(false);
      await result.reload();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to add address");
    }
  };
  const remove = async (id: string) => {
    try {
      await addressesApi.remove(id);
      await result.reload();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to delete address");
    }
  };
  return (
    <main className="app-shell">
      <Header
        title="Address book"
        back="/profile"
        action={
          auth.isAuthenticated ? (
            <button className="text-link" onClick={() => setAdding(!adding)}>
              Add new
            </button>
          ) : undefined
        }
      />
      {adding && (
        <form className="profile-form" onSubmit={(e) => void submit(e)}>
          <label>
            Label
            <input name="label" placeholder="Home" />
          </label>
          <label>
            Address
            <input name="line1" required />
          </label>
          <label>
            City
            <input name="city" required />
          </label>
          <label>
            State / region
            <input name="region" required />
          </label>
          <label>
            Postal code
            <input name="postalCode" required />
          </label>
          <label>
            Country
            <input name="country" required />
          </label>
          <label>
            <input name="isDefault" type="checkbox" /> Make default
          </label>
          <button className="dark-button">Save address</button>
        </form>
      )}
      {error && <p className="state-card error-state">{error}</p>}
      {auth.loading || result.loading ? (
        <LoadingState />
      ) : !auth.isAuthenticated ? (
        <SignInState />
      ) : result.error ? (
        <ErrorState message={result.error} />
      ) : !result.data?.data.length ? (
        <EmptyState message="No delivery addresses saved." />
      ) : (
        <section className="settings-list">
          {result.data.data.map((a) => (
            <article className="address-card" key={a.id}>
              <div className="settings-icon">
                <Icon name="location" />
              </div>
              <div>
                {a.isDefault && <span className="status-badge">Default</span>}
                <h2>{a.label || "Address"}</h2>
                <p>
                  {a.line1}
                  {a.line2 && (
                    <>
                      <br />
                      {a.line2}
                    </>
                  )}
                  <br />
                  {a.city}, {a.region} {a.postalCode}
                  <br />
                  {a.country}
                </p>
              </div>
              <div>
                {!a.isDefault && (
                  <button
                    className="text-link"
                    onClick={() =>
                      void addressesApi
                        .update(a.id, { isDefault: true })
                        .then(() => result.reload())
                        .catch((x: unknown) =>
                          setError(
                            x instanceof Error
                              ? x.message
                              : "Unable to update address",
                          ),
                        )
                    }
                  >
                    Make default
                  </button>
                )}
                <button className="text-link" onClick={() => void remove(a.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
