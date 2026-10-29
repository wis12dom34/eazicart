"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type ContentImageProps = ImageProps & { src: string };

export function ContentImage(props: ContentImageProps) {
  // A new source gets a fresh loading attempt, including when returning to an old URL.
  return <ContentImageSource key={props.src} {...props} />;
}

// Keep arbitrary catalog URLs working; only configured public sources use the optimizer.
function ContentImageSource(props: ContentImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    // Keep an img so existing card geometry/object-fit rules still apply. This is
    // a neutral error label, never replacement product photography or a retry URL.
    const width = Number(props.width) || 398;
    const height = Number(props.height) || 398;
    const label = props.alt
      ? '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#62656b" font-family="sans-serif" font-size="12">Image unavailable</text>'
      : "";
    const placeholder = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f2f2f7"/>${label}</svg>`)}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={placeholder}
        alt={props.alt ? `${props.alt} — image unavailable` : ""}
        width={props.width}
        height={props.height}
        className={props.className}
        style={props.style}
        data-image-unavailable="true"
      />
    );
  }
  // Avatars and Stories own their fallbacks; do not intercept their handlers.
  const onError: NonNullable<ImageProps["onError"]> = (event) => {
    if (props.onError) props.onError(event);
    else setFailed(true);
  };
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
  // SVGs and unsupported sources need no resizing. Preserve their original URLs.
  if (!optimized || /\.svg(?:$|[?#])/i.test(props.src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        {...props}
        onError={onError}
        loading={props.loading ?? "lazy"}
        decoding="async"
      />
    );
  }
  return (
    <Image
      {...props}
      onError={onError}
      unoptimized={!optimized}
      loading={props.loading ?? "lazy"}
      decoding="async"
    />
  );
}
