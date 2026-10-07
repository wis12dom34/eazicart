/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { useState } from "react";
import type { Address } from "../../lib/api/types";
import { BottomNavigation } from "../components/bottom-navigation";
import styles from "./address-selector.module.css";

export function AddressSelector({
  addresses,
  name,
  initialId,
  onAdd,
  onEdit,
}: {
  addresses: Address[];
  name: string;
  initialId?: string;
  onAdd: () => void;
  onEdit: (id: string) => void;
}) {
  const [selection, setSelection] = useState(initialId);
  const selected =
    addresses.find((a) => a.id === selection) ??
    addresses.find((a) => a.isDefault) ??
    addresses[0];
  return (
    <main className={`app-shell ${styles.page}`} data-figma-node="228:214">
      <header className={styles.header}>
        <Link
          href={
            initialId
              ? `/checkout?addressId=${encodeURIComponent(initialId)}`
              : "/checkout"
          }
          aria-label="Back to checkout"
        >
          <img src="/figma/address-select-back.svg" alt="" />
        </Link>
        <h1>Delivery address</h1>
        <p>Choose where this order should be delivered.</p>
      </header>
      <section
        className={styles.options}
        role="radiogroup"
        aria-label="Delivery address"
      >
        {addresses.map((address, index) => (
          <div
            key={address.id}
            className={`${styles.optionWrap} ${index > 0 ? styles.laterOptionWrap : ""}`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected?.id === address.id}
              className={`${styles.option} ${selected?.id === address.id ? styles.selected : ""} ${index > 0 ? styles.laterOption : ""}`}
              onClick={() => setSelection(address.id)}
            >
              <small>{address.label?.toUpperCase() ?? "ADDRESS"}</small>
              <strong>{name}</strong>
              <span>
                {[address.line1, address.line2].filter(Boolean).join(", ")}
              </span>
              <p>
                {[`${address.city}, ${address.country}`, address.phone]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {address.isDefault ? <b>✓ Default</b> : null}
            </button>
            <button
              type="button"
              className={styles.edit}
              onClick={() => onEdit(address.id)}
              aria-label={`Edit ${address.label || "delivery address"}`}
            >
              Edit
            </button>
          </div>
        ))}
      </section>
      <button type="button" className={styles.add} onClick={onAdd}>
        + Add new address
      </button>
      {selected ? (
        <Link
          className={styles.use}
          href={`/checkout?addressId=${encodeURIComponent(selected.id)}`}
        >
          Use selected address
        </Link>
      ) : (
        <span className={styles.use}>Add an address to continue</span>
      )}
      <BottomNavigation activeHref="/cart" />
    </main>
  );
}
