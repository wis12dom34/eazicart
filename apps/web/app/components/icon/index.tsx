import type { ReactNode } from "react";

const outlinePaths = {
  home: (
    <>
      <path d="m2.75 10.25 9.25-7.5 9.25 7.5" />
      <path d="M5.25 8.75V20a1 1 0 0 0 1 1h3.25v-7h5v7h3.25a1 1 0 0 0 1-1V8.75" />
    </>
  ),
  search: (
    <>
      <circle cx="10.75" cy="10.75" r="7.25" />
      <path d="m16.2 16.2 4.8 4.8" />
    </>
  ),
  reels: (
    <>
      <rect x="2.75" y="5.75" width="18.5" height="15" rx="3" />
      <path d="M6.25 2.75h11.5" />
      <path d="m10 10.5 5.25 3-5.25 3v-6Z" />
    </>
  ),
  cart: (
    <>
      <path d="M2.5 3.5h2.25l2.1 11.35a2 2 0 0 0 1.95 1.65h8.85a2 2 0 0 0 1.95-1.6L21.25 7H5.45" />
      <circle cx="9" cy="20.25" r="1.25" />
      <circle cx="18" cy="20.25" r="1.25" />
    </>
  ),
  chat: <path d="M12 3.25c-5.1 0-9.25 3.45-9.25 7.75 0 2.2 1.1 4.2 2.9 5.65L4.5 20.75l4.75-2.2c.9.25 1.8.4 2.75.4 5.1 0 9.25-3.45 9.25-7.75S17.1 3.25 12 3.25Z" />,
  message: <path d="M4 4.5h16v12H8l-4 3v-15Z" />,
  bag: (
    <>
      <path d="M5 8.25h14l1 12.5H4l1-12.5Z" />
      <path d="M9 8.5V6a3 3 0 0 1 6 0v2.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.25 20.75a7.75 7.75 0 0 1 15.5 0" />
    </>
  ),
  "user-circle": (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="9" r="3" />
      <path d="M5.25 18.75a7.25 7.25 0 0 1 13.5 0" />
    </>
  ),
  close: <path d="m6.5 6.5 11 11m0-11-11 11" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  store: (
    <>
      <path d="M3.25 9.5 5.25 3h13.5l2 6.5" />
      <path d="M4.25 10v10.75h15.5V10M9 20.75v-6.5h6v6.5" />
      <path d="M3.25 9.5a2.75 2.75 0 0 0 5.5 0 2.75 2.75 0 0 0 5.5 0 2.75 2.75 0 0 0 5.5 0M8.75 9.5l.9-6.5m5.6 6.5-.9-6.5" />
    </>
  ),
  chart: <path d="M3.5 3.5v17h17M7 16v-4.5m5 4.5V7.5m5 8.5V5" />,
  bell: (
    <>
      <path d="M18.25 9.5a6.25 6.25 0 0 0-12.5 0c0 6.5-2.75 6.75-2.75 8.75h18c0-2-2.75-2.25-2.75-8.75Z" />
      <path d="M9.75 20.5a2.5 2.5 0 0 0 4.5 0" />
    </>
  ),
  heart: <path d="M20.5 5a5.25 5.25 0 0 0-7.45 0L12 6.05 10.95 5A5.25 5.25 0 0 0 3.5 12.4L12 20.75l8.5-8.35A5.25 5.25 0 0 0 20.5 5Z" />,
  share: (
    <>
      <path d="M12 15V3.25m-4.25 4L12 3l4.25 4.25" />
      <path d="M8.25 10.75H5v10h14v-10h-3.25" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.25 15.1a1.75 1.75 0 0 0 .3 1.9l.15.15-2.55 2.55-.15-.15a1.75 1.75 0 0 0-1.9-.3 1.75 1.75 0 0 0-1.05 1.6V21h-3.6v-.15a1.75 1.75 0 0 0-1.05-1.6 1.75 1.75 0 0 0-1.9.3l-.15.15-2.55-2.55.15-.15a1.75 1.75 0 0 0 .3-1.9A1.75 1.75 0 0 0 3.65 14H3.5v-4h.15a1.75 1.75 0 0 0 1.6-1.05 1.75 1.75 0 0 0-.3-1.9L4.8 6.9l2.55-2.55.15.15a1.75 1.75 0 0 0 1.9.3 1.75 1.75 0 0 0 1.05-1.6V3h3.6v.2a1.75 1.75 0 0 0 1.05 1.6 1.75 1.75 0 0 0 1.9-.3l.15-.15L19.7 6.9l-.15.15a1.75 1.75 0 0 0-.3 1.9A1.75 1.75 0 0 0 20.85 10H21v4h-.15a1.75 1.75 0 0 0-1.6 1.1Z" />
    </>
  ),
  chevron: <path d="m9.25 18.25 6.25-6.25-6.25-6.25" />,
  "chevron-down": <path d="m5.75 9.25 6.25 6.25 6.25-6.25" />,
  back: <path d="m14.75 18.25-6.25-6.25 6.25-6.25" />,
  filter: <path d="M4 7h16M7 12h10M10 17h4" />,
  star: <path d="m12 3 2.8 5.65 6.2.9-4.5 4.4 1.05 6.2L12 17.2l-5.55 2.95 1.05-6.2L3 9.55l6.2-.9L12 3Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.25 4 4L19 6.5" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.25 2.5 2.5 5.5-6" />
    </>
  ),
  location: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.25" />
    </>
  ),
  "location-arrow": <path d="m20.5 3.5-7.25 17-2.1-7-7.65-2.75 17-7.25Z" />,
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.25" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 6.25h14.5A1.5 1.5 0 0 1 20 7.75v10.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3 18.25V5.5A1.5 1.5 0 0 1 4.5 4h12" />
      <path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z" />
    </>
  ),
  bank: (
    <>
      <path d="M3 9h18L12 3 3 9ZM5 10.5v7m4-7v7m6-7v7m4-7v7M3 20h18" />
    </>
  ),
  box: (
    <>
      <path d="m4 7 8-4 8 4-8 4-8-4Z" />
      <path d="M4 7v10l8 4 8-4V7M12 11v10" />
    </>
  ),
  bookmark: <path d="M6.25 3.25h11.5v17.5L12 17l-5.75 3.75V3.25Z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 5.25a3 3 0 0 1 0 5.5M17 14a5 5 0 0 1 4 5" />
    </>
  ),
  shirt: <path d="m8 4-5 4 3 4 2-1v10h8V11l2 1 3-4-5-4c-1 2-7 2-8 0Z" />,
  sparkle: <path d="M12 2.5c1 5.75 3.75 8.5 9.5 9.5-5.75 1-8.5 3.75-9.5 9.5-1-5.75-3.75-8.5-9.5-9.5 5.75-1 8.5-3.75 9.5-9.5Z" />,
  play: <path d="m9 6.75 9 5.25-9 5.25V6.75Z" />,
  pause: <path d="M8.5 6v12M15.5 6v12" />,
  volume: (
    <>
      <path d="M11 5.25 6 9H3v6h3l5 3.75V5.25Z" />
      <path d="M15 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13" />
    </>
  ),
  "volume-off": (
    <>
      <path d="M11 5.25 6 9H3v6h3l5 3.75V5.25Z" />
      <path d="m16 9 5 5m0-5-5 5" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l10-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  edit: (
    <>
      <path d="m14.5 5.5 4 4L8 20H4v-4L14.5 5.5Z" />
      <path d="m13 7 4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9 3.5h6L16 7H8l1-3.5ZM7 7l.75 13h8.5L17 7M10 10.5v6m4-6v6" />
    </>
  ),
  camera: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2l1.1-1.5h4.8L15.5 5h2A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
      <circle cx="12" cy="12" r="3.25" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4m-4 4 4-4 4 4" />
      <path d="M5 14v6h14v-6" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m5.5 17 4.5-4 3 2.5 2.5-2 3 3.5" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v11H3V6Zm11 4h3l4 4v3h-7v-7Z" />
      <circle cx="7" cy="19" r="2" />
      <circle cx="18" cy="19" r="2" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.5V5h7.5l9.5 9.5-6 6L5 11V5" />
      <circle cx="8" cy="8" r="1" />
    </>
  ),
  coupon: (
    <>
      <path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V6Z" />
      <path d="M12 7.5v9" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5 21 20H3L12 3.5Z" />
      <path d="M12 9v5m0 3h.01" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6m0-6-6 6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5V17m0-10h.01" />
    </>
  ),
  offline: (
    <>
      <path d="M5 9.5a10.5 10.5 0 0 1 13-.75M8 13a6.5 6.5 0 0 1 6-.9M11 16.5a2.5 2.5 0 0 1 2 0" />
      <path d="m4 4 16 16" />
    </>
  ),
  send: <path d="m3 11 18-8-8 18-2-8-8-2Z" />,
  paperclip: <path d="m8.5 12.5 6.25-6.25a3.2 3.2 0 0 1 4.5 4.5L11 19a5 5 0 0 1-7-7l8-8" />,
  microphone: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4m-4 0h8" />
    </>
  ),
  phone: <path d="M7 3.5 10 8 8 10c1.5 3 3 4.5 6 6l2-2 4.5 3c-.5 2.5-2 4-4.5 4-6.5-1.5-11.5-6.5-13-13 0-2.5 1.5-4 4-4.5Z" />,
  video: (
    <>
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="m15 10 6-3v10l-6-3" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M3 3 21 21M10.6 6.1A10.2 10.2 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.7M6.1 7.2A16.5 16.5 0 0 0 2.5 12s3.5 6 9.5 6a9 9 0 0 0 2-.2" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 10h18" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H5v16h5" />
      <path d="M14 8l4 4-4 4m4-4H9" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2.25-2.5 4m0 3.5h.01" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof outlinePaths;
export type IconWeight = "regular" | "medium" | "semibold";
export type IconState = "default" | "active" | "disabled";

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
  /** Compatibility alias for older call sites. Prefer `active` for selected UI. */
  filled?: boolean;
  active?: boolean;
  weight?: IconWeight;
  state?: IconState;
  accessibilityLabel?: string;
};

const filledPaths: Partial<Record<IconName, ReactNode>> = {
  home: <path d="M12 2.5 2.5 10l1.25 1.55L5 10.55V20a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1v-9.45l1.25 1 1.25-1.55L12 2.5Z" />,
  reels: <path fillRule="evenodd" d="M6 2.5h12v1.75H6V2.5ZM5.75 6A3.25 3.25 0 0 0 2.5 9.25v8.5A3.25 3.25 0 0 0 5.75 21h12.5a3.25 3.25 0 0 0 3.25-3.25v-8.5A3.25 3.25 0 0 0 18.25 6H5.75ZM10 10v7l5.5-3.5L10 10Z" />,
  cart: (
    <>
      <path d="M5.2 7h16l-1.65 7.9a2 2 0 0 1-1.95 1.6H8.8a2 2 0 0 1-1.95-1.65L5.2 7Z" />
      <path d="M2.5 3.5h2.25l.65 3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="20.25" r="1.5" />
      <circle cx="18" cy="20.25" r="1.5" />
    </>
  ),
  chat: <path d="M12 3.25c-5.1 0-9.25 3.45-9.25 7.75 0 2.2 1.1 4.2 2.9 5.65L4.5 20.75l4.75-2.2c.9.25 1.8.4 2.75.4 5.1 0 9.25-3.45 9.25-7.75S17.1 3.25 12 3.25Z" />,
  heart: <path d="M20.5 5a5.25 5.25 0 0 0-7.45 0L12 6.05 10.95 5A5.25 5.25 0 0 0 3.5 12.4L12 20.75l8.5-8.35A5.25 5.25 0 0 0 20.5 5Z" />,
  bookmark: <path d="M6.25 3.25h11.5v17.5L12 17l-5.75 3.75V3.25Z" />,
  star: <path d="m12 2.75 2.9 5.9 6.5.95-4.7 4.55 1.1 6.45L12 17.5l-5.8 3.05 1.1-6.4-4.7-4.55 6.5-.95L12 2.75Z" />,
  bell: <path d="M18.25 9.5a6.25 6.25 0 0 0-12.5 0c0 6.5-2.75 6.75-2.75 8.75h18c0-2-2.75-2.25-2.75-8.75ZM9.5 20.25h5a2.5 2.5 0 0 1-5 0Z" />,
  user: <path d="M12 3.75A4.25 4.25 0 1 1 12 12a4.25 4.25 0 0 1 0-8.25ZM4 21a8 8 0 0 1 16 0H4Z" />,
  bag: <path d="M5 8.25h14l1 12.5H4l1-12.5ZM9 8.25h6V6a3 3 0 0 0-6 0v2.25Z" />,
  box: <path d="m4 7 8-4 8 4-8 4-8-4Zm0 2 7 3.5V21l-7-3.5V9Zm9 3.5L20 9v8.5L13 21v-8.5Z" />,
  store: <path d="M5.25 3h13.5l2 6.5a2.75 2.75 0 0 1-5.5 0 2.75 2.75 0 0 1-5.5 0 2.75 2.75 0 0 1-5.5 0L5.25 3ZM4.25 12.5v8.25h15.5V12.5a4 4 0 0 1-4.5-.75 4 4 0 0 1-6.5 0 4 4 0 0 1-4.5.75Z" />,
  "check-circle": <path fillRule="evenodd" d="M12 2.75a9.25 9.25 0 1 0 0 18.5 9.25 9.25 0 0 0 0-18.5Zm4.65 6.1-5.3 6.1a1 1 0 0 1-1.48.04L7.2 12.3l1.4-1.4 1.9 1.9 4.65-5.35 1.5 1.4Z" />,
};

const weightStroke: Record<IconWeight, number> = {
  regular: 1.75,
  medium: 2,
  semibold: 2.2,
};

export function Icon({
  name,
  size = 24,
  className,
  filled = false,
  active = false,
  weight = "regular",
  state = "default",
  accessibilityLabel,
}: IconProps) {
  const selected = active || state === "active";
  const solid = filled || selected ? filledPaths[name] : undefined;
  const effectiveWeight = selected && !solid && weight === "regular" ? "semibold" : weight;
  const labelled = Boolean(accessibilityLabel);

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? "currentColor" : "none"}
      stroke={solid ? "none" : "currentColor"}
      strokeWidth={weightStroke[effectiveWeight]}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={labelled ? undefined : true}
      aria-label={accessibilityLabel}
      role={labelled ? "img" : undefined}
      focusable="false"
      style={state === "disabled" ? { opacity: 0.42 } : undefined}
    >
      {solid ?? outlinePaths[name]}
    </svg>
  );
}
