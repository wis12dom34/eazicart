/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import {
  fetchProfilePhoto,
  PROFILE_PHOTO_EVENT,
  type SocialMediaItem,
} from "../../lib/social-media";

export function ProfileAvatar({
  userId,
  name,
  alt = "",
}: {
  userId: string;
  name: string;
  alt?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchProfilePhoto(userId).then((photo) => {
      if (active) setUrl(photo?.url ?? null);
    });

    const onPhotoUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          userId: string;
          photo: SocialMediaItem;
        }>
      ).detail;
      if (detail?.userId === userId) setUrl(detail.photo.url);
    };
    window.addEventListener(PROFILE_PHOTO_EVENT, onPhotoUpdated);

    return () => {
      active = false;
      window.removeEventListener(PROFILE_PHOTO_EVENT, onPhotoUpdated);
    };
  }, [userId]);

  if (!url) return <>{name[0]?.toUpperCase() || "W"}</>;

  return (
    <img
      src={url}
      alt={alt}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: "cover",
        borderRadius: "50%",
        pointerEvents: "none",
      }}
    />
  );
}
