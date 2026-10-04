/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
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
import { AddressSelector } from "./address-selector";

const formString = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

const addressPayload = (form: FormData): AddressInput => ({
  label: formString(form, "label") || undefined,
  line1: formString(form, "line1"),
  line2: formString(form, "line2") || undefined,
  city: formString(form, "city"),
  region: formString(form, "region"),
  postalCode: formString(form, "postalCode"),
  country: formString(form, "country"),
  isDefault: form.get("isDefault") === "on",
  phone: formString(form, "phone") || undefined,
});

export function AddressBookContent({
  checkout,
  selectedId,
  initialEditId,
}: {
  checkout?: boolean;
  selectedId?: string;
  initialEditId?: string;
}) {
  const auth = useAuth();
  const user = auth.user;
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(
    initialEditId ?? null,
  );
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
      await addressesApi.create(
        addressPayload(new FormData(event.currentTarget)),
      );
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

  if (
    checkout &&
    !adding &&
    !editingId &&
    user &&
    !result.loading &&
    result.data
  )
    return (
      <AddressSelector
        addresses={result.data.data}
        name={user.name}
        initialId={selectedId}
        onAdd={() => setAdding(true)}
        onEdit={(id) => {
          setEditingId(id);
          setAdding(false);
          setError("");
        }}
      />
    );

  if (
    checkout &&
    (adding || editingId) &&
    user &&
    !result.loading &&
    result.data
  ) {
    const editingAddress = editingId
      ? result.data.data.find((address) => address.id === editingId)
      : undefined;
    const isEditing = Boolean(editingAddress);

    return (
      <main
        className={`app-shell ${styles.checkoutEditorPage}`}
        data-figma-node={isEditing ? "212:70" : "212:36"}
      >
        <div className={styles.checkoutEditor}>
          <div className={styles.checkoutEditorHeader}>
            <h1>
              {isEditing ? "Edit delivery address" : "Add delivery address"}
            </h1>
            <p>
              {isEditing
                ? "Update your delivery details."
                : "Where should we deliver your order?"}
            </p>
          </div>

          <AddressForm
            userName={isEditing ? user.name : undefined}
            address={editingAddress}
            submitLabel={isEditing ? "Save changes" : "Save address"}
            onSubmit={(event) =>
              isEditing && editingAddress
                ? void updateAddress(event, editingAddress.id)
                : void addAddress(event)
            }
            onCancel={() => {
              setAdding(false);
              setEditingId(null);
              setError("");
            }}
          />

          {error ? (
            <p className={styles.checkoutEditorError} role="alert">
              {error}
            </p>
          ) : null}

          {isEditing && editingAddress ? (
            <div className={styles.checkoutEditorSecondaryActions}>
              {!editingAddress.isDefault ? (
                <button
                  className={styles.secondaryAction}
                  type="button"
                  onClick={() => void makeDefault(editingAddress.id)}
                >
                  Make default
                </button>
              ) : null}
              <button
                className={styles.dangerAction}
                type="button"
                onClick={() => void remove(editingAddress.id)}
              >
                Delete address
              </button>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  if (
    !checkout &&
    (adding || editingId) &&
    user &&
    !result.loading &&
    result.data
  ) {
    const editingAddress = editingId
      ? result.data.data.find((address) => address.id === editingId)
      : undefined;
    const isEditing = Boolean(editingAddress);

    return (
      <main
        className={`app-shell with-nav ${styles.checkoutEditorPage}`}
        data-figma-node={isEditing ? "373:1637" : "373:1622"}
      >
        <div className={styles.checkoutEditor}>
          <div className={styles.checkoutEditorHeader}>
            <h1>
              {isEditing ? "Edit delivery address" : "Add delivery address"}
            </h1>
            <p>
              {isEditing
                ? "Where should we deliver your order?"
                : "Where should we deliver your order?"}
            </p>
          </div>

          <AddressForm
            userName={isEditing ? user.name : undefined}
            address={editingAddress}
            submitLabel={isEditing ? "Save changes" : "Save address"}
            onSubmit={(event) =>
              isEditing && editingAddress
                ? void updateAddress(event, editingAddress.id)
                : void addAddress(event)
            }
            onCancel={() => {
              setAdding(false);
              setEditingId(null);
              setError("");
            }}
          />

          {error ? (
            <p className={styles.checkoutEditorError} role="alert">
              {error}
            </p>
          ) : null}

          {isEditing && editingAddress ? (
            <div className={styles.checkoutEditorSecondaryActions}>
              {!editingAddress.isDefault ? (
                <button
                  className={styles.secondaryAction}
                  type="button"
                  onClick={() => void makeDefault(editingAddress.id)}
                >
                  Make default
                </button>
              ) : null}
              <button
                className={styles.dangerAction}
                type="button"
                onClick={() => void remove(editingAddress.id)}
              >
                Delete address
              </button>
            </div>
          ) : null}
        </div>
        <BottomNavigation />
      </main>
    );
  }

  return (
    <main className={`app-shell ${styles.page}`} data-figma-node="30:2">
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Link
            className={styles.back}
            href="/profile"
            aria-label="Back to profile"
          >
            <img
              src="/figma/address-select-back.svg"
              width={10}
              height={18}
              alt=""
            />
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
              setAdding(true);
              setEditingId(null);
              setError("");
            }}
          >
            +&nbsp;&nbsp;Add new address
          </button>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {auth.loading || result.loading ? (
          <LoadingState />
        ) : !user ? (
          <SignInState message="Sign in to manage delivery addresses." />
        ) : result.error ? (
          <ErrorState
            message={result.error}
            retry={() => void result.reload()}
          />
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
                    className={`${styles.card} ${
                      address.isDefault ? styles.defaultCard : ""
                    }`}
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
                        className={`${styles.editButton} ${
                          address.isDefault ? "" : styles.secondaryEdit
                        }`}
                        type="button"
                        onClick={() => {
                          setEditingId(address.id);
                          setAdding(false);
                          setError("");
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    <h2>{user.name}</h2>
                    <p className={styles.addressLine}>
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}
                    </p>
                    <p className={styles.metaLine}>
                      {formatAddressLocation(address)}
                      {address.phone ? ` · ${address.phone}` : ""}
                    </p>
                    {address.isDefault ? (
                      <span className={styles.defaultBadge}>Default</span>
                    ) : null}
                  </article>
                ))}
              </section>
            )}

            <aside className={styles.tip}>
              <strong>Delivery tip</strong>
              <p>
                Add landmarks and a reachable phone number to help sellers
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

function formatAddressLocation(address: Address) {
  const location = [
    address.city,
    address.region && address.region !== address.city ? address.region : null,
    address.country,
  ].filter(Boolean);
  return location.join(", ");
}

function AddressForm({
  userName,
  address,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  userName?: string;
  address?: Address;
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
}) {
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.field}>
        <span>Full name</span>
        <input
          className={styles.input}
          value={userName ?? ""}
          readOnly
          aria-readonly="true"
          placeholder="Your full name"
        />
      </label>
      <label className={styles.field}>
        <span>Phone number</span>
        <input
          className={styles.input}
          name="phone"
          type="tel"
          placeholder="+234 · Phone number"
          defaultValue={address?.phone || ""}
        />
      </label>
      <label className={styles.field}>
        <span>Street address</span>
        <input
          className={styles.input}
          name="line1"
          required
          placeholder="House number and street"
          defaultValue={address?.line1 || ""}
        />
      </label>
      <label className={styles.field}>
        <span>State</span>
        <input
          className={styles.input}
          name="region"
          required
          placeholder="Enter state"
          defaultValue={address?.region || ""}
        />
      </label>
      <label className={styles.field}>
        <span>City / Area</span>
        <input
          className={styles.input}
          name="city"
          required
          placeholder="Enter city or area"
          defaultValue={address?.city || ""}
        />
      </label>
      <label className={styles.field}>
        <span>Landmark (optional)</span>
        <input
          className={styles.input}
          name="line2"
          placeholder="A nearby place or delivery note"
          defaultValue={address?.line2 || ""}
        />
      </label>
      <input
        type="hidden"
        name="postalCode"
        value={address?.postalCode || ""}
      />
      <input type="hidden" name="country" value={address?.country || "Nigeria"} />
      <input type="hidden" name="label" value={address?.label || ""} />
      <input
        type="hidden"
        name="isDefault"
        value={address?.isDefault ? "on" : ""}
      />
      <div className={styles.editorActions}>
        <button className={styles.primaryAction} type="submit">
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            className={styles.cancelAction}
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
