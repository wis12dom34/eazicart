/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { fetchProfilePhoto } from "../../lib/social-media";

export function ProfileAvatar({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchProfilePhoto(userId).then((photo) => {
      if (active) setUrl(photo?.url ?? null);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  if (!url) return <>{name[0]?.toUpperCase() || "W"}</>;

  return (
    <img
      src={url}
      alt=""
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
