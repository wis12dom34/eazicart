"use client";

import { useEffect, useState } from "react";
import { ContentImage } from "./content-image";
import {
  fetchProfilePhoto,
  invalidateProfilePhoto,
  PROFILE_PHOTO_EVENT,
  PROFILE_PHOTO_STORAGE_KEY,
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
  const [image, setImage] = useState<{ userId: string; url: string | null }>();
  const url = image?.userId === userId ? image.url : null;

  useEffect(() => {
    let active = true;
    let revision = 0;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      const currentRevision = ++revision;
      void fetchProfilePhoto(userId).then((photo) => {
        if (active && currentRevision === revision)
          setImage((current) => {
            const url = photo?.url ?? null;
            return current?.userId === userId && current.url === url
              ? current
              : { userId, url };
          });
      });
    };

    const onPhotoUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          userId: string;
          photo: SocialMediaItem | null;
        }>
      ).detail;
      if (detail?.userId === userId) {
        revision++;
        setImage({ userId, url: detail.photo?.url ?? null });
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PROFILE_PHOTO_STORAGE_KEY || !event.newValue) return;
      try {
        const detail = JSON.parse(event.newValue) as { userId?: string };
        if (detail.userId === userId) {
          invalidateProfilePhoto(userId);
          refresh();
        }
      } catch {
        // Ignore malformed invalidation signals.
      }
    };
    window.addEventListener(PROFILE_PHOTO_EVENT, onPhotoUpdated);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    refresh();

    return () => {
      active = false;
      window.removeEventListener(PROFILE_PHOTO_EVENT, onPhotoUpdated);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId]);

  if (!url) return <>{name[0]?.toUpperCase() || "W"}</>;

  return (
    <ContentImage
      src={url}
      alt={alt}
      width={128}
      height={128}
      sizes="128px"
      loading="lazy"
      decoding="async"
      onError={() => setImage({ userId, url: null })}
      style={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        display: "block",
        objectFit: "cover",
        borderRadius: "50%",
        pointerEvents: "none",
      }}
    />
  );
}
