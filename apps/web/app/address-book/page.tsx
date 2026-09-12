"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { addressesApi, type AddressInput } from "../../lib/api/addresses";
import type { Address } from "../../lib/api/types";
import { useRequest } from "../hooks/use-request";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
import styles from "./address-book.module.css";

const formString = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

const addressPayload = (form: FormData): AddressInput => ({
  label: formString(form, "label"),
  line1: formString(form, "line1"),
  line2: formString(form, "line2") || undefined,
  city: formString(form, "city"),
  region: formString(form, "region"),
  postalCode: formString(form, "postalCode"),
  country: formString(form, "country"),
  isDefault: form.get("isDefault") === "on",
});

export default function AddressBook() {
  const auth = useAuth();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const result = useRequest(
    async () =>
      auth.isAuthenticated ? addressesApi.list() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );

  const addAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setError("");
      await addressesApi.create(addressPayload(new FormData(event.currentTarget)));
      setAdding(false);
      await result.reload();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to add address");
    }
  };

  const updateAddress = async (
    event: FormEvent<HTMLFormElement>,
    addressId: string,
  ) => {
    event.preventDefault();
    try {
      setError("");
      await addressesApi.update(
        addressId,
        addressPayload(new FormData(event.currentTarget)),
      );
      setEditingId(null);
      await result.reload();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to update address");
    }
  };

  const remove = async (id: string) => {
    try {
      setError("");
      await addressesApi.remove(id);
      setEditingId(null);
      await result.reload();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to delete address");
    }
  };

  const makeDefault = async (id: string) => {
    try {
      setError("");
      await addressesApi.update(id, { isDefault: true });
      setEditingId(null);
      await result.reload();
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to update address");
    }
  };

  return (
    <main className={`app-shell ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Link className={styles.back} href="/profile" aria-label="Back to profile">
            <Icon name="back" size={22} />
          </Link>
          <h1>Address Book</h1>
        </div>
        <p>Choose where your EaziCart orders should be delivered.</p>
      </header>

      <div className={styles.content}>
        {auth.isAuthenticated ? (
          <button
            className={styles.addButton}
            type="button"
            onClick={() => {
              setAdding((value) => !value);
              setEditingId(null);
              setError("");
            }}
          >
            +&nbsp; Add new address
          </button>
        ) : null}

        {adding ? (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Add new address</h2>
            <AddressForm submitLabel="Save address" onSubmit={addAddress} />
          </div>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {auth.loading || result.loading ? (
          <LoadingState />
        ) : !auth.isAuthenticated ? (
          <SignInState message="Sign in to manage delivery addresses." />
        ) : result.error ? (
          <ErrorState message={result.error} retry={() => void result.reload()} />
        ) : (
          <>
            <h2 className={styles.sectionTitle}>Saved addresses</h2>
            {!result.data?.data.length ? (
              <div className={styles.emptyWrap}>
                <EmptyState message="No delivery addresses saved." />
              </div>
            ) : (
              <section className={styles.list} aria-label="Saved addresses">
                {result.data.data.map((address) => (
                  <article
                    className={`address-card ${styles.card}`}
                    key={address.id}
                  >
                    <div className={styles.cardTop}>
                      <span
                        className={`${styles.label} ${
                          address.isDefault ? styles.defaultLabel : ""
                        }`}
                      >
                        {address.label || "Address"}
                      </span>
                      <button
                        className={styles.editButton}
                        type="button"
                        onClick={() => {
                          setEditingId((value) =>
                            value === address.id ? null : address.id,
                          );
                          setAdding(false);
                          setError("");
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    <h2>{address.line1}</h2>
                    {address.line2 ? (
                      <p className={styles.addressLine}>{address.line2}</p>
                    ) : null}
                    <p className={styles.addressLine}>
                      {address.city}, {address.region} {address.postalCode}
                    </p>
                    <p className={styles.metaLine}>{address.country}</p>
                    {address.isDefault ? (
                      <span className={styles.defaultBadge}>Default</span>
                    ) : null}

                    {editingId === address.id ? (
                      <div className={styles.formCard}>
                        <AddressForm
                          address={address}
                          submitLabel="Save changes"
                          onSubmit={(event) =>
                            void updateAddress(event, address.id)
                          }
                        />
                        <div className={styles.formActions}>
                          {!address.isDefault ? (
                            <button
                              className={styles.secondaryAction}
                              type="button"
                              onClick={() => void makeDefault(address.id)}
                            >
                              Make default
                            </button>
                          ) : null}
                          <button
                            className={styles.dangerAction}
                            type="button"
                            onClick={() => void remove(address.id)}
                          >
                            Delete address
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </section>
            )}

            <aside className={styles.tip}>
              <strong>Delivery tip</strong>
              <p>
                Add landmarks and complete delivery details to help sellers
                deliver faster.
              </p>
            </aside>
          </>
        )}
      </div>
      <BottomNavigation />
    </main>
  );
}

function AddressForm({
  address,
  submitLabel,
  onSubmit,
}: {
  address?: Address;
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.field}>
        <span>Label</span>
        <input
          className={styles.input}
          name="label"
          placeholder="Home"
          defaultValue={address?.label || ""}
        />
      </label>
      <label className={styles.field}>
        <span>Address</span>
        <input
          className={styles.input}
          name="line1"
          required
          defaultValue={address?.line1 || ""}
        />
      </label>
      <label className={styles.field}>
        <span>Address line 2</span>
        <input
          className={styles.input}
          name="line2"
          defaultValue={address?.line2 || ""}
        />
      </label>
      <label className={styles.field}>
        <span>City</span>
        <input
          className={styles.input}
          name="city"
          required
          defaultValue={address?.city || ""}
        />
      </label>
      <label className={styles.field}>
        <span>State / region</span>
        <input
          className={styles.input}
          name="region"
          required
          defaultValue={address?.region || ""}
        />
      </label>
      <label className={styles.field}>
        <span>Postal code</span>
        <input
          className={styles.input}
          name="postalCode"
          required
          defaultValue={address?.postalCode || ""}
        />
      </label>
      <label className={styles.field}>
        <span>Country</span>
        <input
          className={styles.input}
          name="country"
          required
          defaultValue={address?.country || ""}
        />
      </label>
      <label className={styles.defaultField}>
        <input
          name="isDefault"
          type="checkbox"
          defaultChecked={address?.isDefault}
        />
        <span>Make default</span>
      </label>
      <button className={styles.primaryAction} type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
