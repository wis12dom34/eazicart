/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, type ChangeEvent } from "react";
import { productsApi } from "../../../lib/api/products";
import styles from "./product-image-picker.module.css";

const MAX_IMAGES = 6;
const MAX_BYTES = 8 * 1024 * 1024;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const isHostedImage = (value: string) => /^https?:\/\//i.test(value);
const supportedFile = (file: File) =>
  supportedTypes.has(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);

export function ProductImagePicker({
  initialUrls = [],
  disabled = false,
  onUploadingChange,
}: {
  initialUrls?: string[];
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [images, setImages] = useState(() =>
    initialUrls.filter(isHostedImage).slice(0, MAX_IMAGES),
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const choosePhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!selected.length) return;

    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setError(`You can upload up to ${MAX_IMAGES} photos.`);
      return;
    }
    const files = selected.slice(0, room);
    const invalid = files.find((file) => !supportedFile(file));
    if (invalid) {
      setError("Choose JPG, PNG or WebP photos.");
      return;
    }
    const tooLarge = files.find((file) => file.size > MAX_BYTES);
    if (tooLarge) {
      setError("Each photo must be smaller than 8 MB.");
      return;
    }

    setError("");
    setUploading(true);
    onUploadingChange?.(true);
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Uploading ${index + 1} of ${files.length}…`);
        const result = await productsApi.uploadImage(file);
        setImages((current) =>
          [...current, result.data.imageUrl].slice(0, MAX_IMAGES),
        );
      }
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to upload this photo.",
      );
    } finally {
      setProgress("");
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  const removeImage = (index: number) =>
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const makeCover = (index: number) =>
    setImages((current) => {
      if (index <= 0 || index >= current.length) return current;
      const next = [...current];
      const selected = next.splice(index, 1)[0];
      if (!selected) return current;
      next.unshift(selected);
      return next;
    });

  return (
    <fieldset className={styles.picker} disabled={disabled || uploading}>
      <legend>Product photos</legend>
      <div className={styles.heading}>
        <span>{images.length ? `${images.length}/${MAX_IMAGES} added` : "Add real product photos"}</span>
        {uploading ? <strong role="status">{progress || "Uploading…"}</strong> : null}
      </div>

      <div className={styles.gallery}>
        {images.map((url, index) => (
          <div className={styles.photo} key={url}>
            <img src={url} alt={`Product photo ${index + 1}`} />
            {index === 0 ? <span className={styles.coverBadge}>Cover</span> : null}
            <button
              className={styles.remove}
              type="button"
              aria-label={`Remove product photo ${index + 1}`}
              onClick={() => removeImage(index)}
            >
              ×
            </button>
            {index > 0 ? (
              <button
                className={styles.coverButton}
                type="button"
                onClick={() => makeCover(index)}
              >
                Make cover
              </button>
            ) : null}
            <input type="hidden" name="imageUrls" value={url} />
          </div>
        ))}

        {images.length < MAX_IMAGES ? (
          <label className={styles.addPhoto}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2l1.1-1.5h4.8L15.5 5h2A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
              <circle cx="12" cy="12" r="3.25" />
              <path d="M18 8h.01" />
            </svg>
            <span>{images.length ? "Add more" : "Choose photos"}</span>
            <small>Photo Library</small>
            <input
              className={styles.fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => void choosePhotos(event)}
              aria-label="Choose product photos from your device"
            />
          </label>
        ) : null}
      </div>

      <p className={styles.helper}>
        Choose up to {MAX_IMAGES} photos from your gallery. The first photo is the cover shown in Explore and your storefront. JPG, PNG or WebP, max 8 MB each.
      </p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
