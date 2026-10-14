"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

// Keep arbitrary catalog URLs working; only configured public sources use the optimizer.
export function ContentImage(props: ImageProps & { src: string }) {
  const [originalRetry, setOriginalRetry] = useState<string>();
  const [failedSource, setFailedSource] = useState<string>();
  let optimized = props.src.startsWith("/") && !props.src.startsWith("//");
  try {
    const url = new URL(props.src);
    optimized =
      url.protocol === "https:" &&
      !url.port &&
      (url.hostname.endsWith(".public.blob.vercel-storage.com") ||
        (url.hostname === "images.unsplash.com" &&
          url.pathname.startsWith("/photo-")));
  } catch {
    // Relative assets are handled by Next; data URLs bypass optimization.
  }
  const svg = /\.svg(?:$|[?#])/i.test(props.src);
  const unavailable = failedSource === props.src;
  const direct = !optimized || svg || originalRetry === props.src;
  const onError: NonNullable<ImageProps["onError"]> = (event) => {
    if (!direct) {
      // Optimizer failures should not hide a working original photo.
      setOriginalRetry(props.src);
      return;
    }
    setFailedSource(props.src);
    props.onError?.(event);
  };

  if (unavailable || direct) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        {...props}
        key={`${props.src}:${unavailable ? "unavailable" : "original"}`}
        src={unavailable ? "/photo-unavailable.svg" : props.src}
        alt={
          unavailable
            ? `Photo unavailable${props.alt ? `: ${props.alt}` : ""}`
            : props.alt
        }
        data-photo-unavailable={unavailable || undefined}
        loading={props.loading ?? "lazy"}
        decoding="async"
        onError={unavailable ? undefined : onError}
      />
    );
  }
  return (
    <Image
      {...props}
      key={`${props.src}:optimized`}
      loading={props.loading ?? "lazy"}
      decoding="async"
      onError={onError}
    />
  );
}
