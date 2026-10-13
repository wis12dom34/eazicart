type IconProps = {
  name: string;
  size?: number;
  className?: string;
  filled?: boolean;
};
const paths: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="m2.5 10 9.5-7.5 9.5 7.5" />
      <path d="M5 8.5V20a1 1 0 0 0 1 1h3v-7h6v7h3a1 1 0 0 0 1-1V8.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="7.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  reels: (
    <>
      <path d="M6 3h12" />
      <rect x="2.5" y="6.5" width="19" height="15" rx="3" />
      <path d="m10 11 5 3-5 3v-6Z" />
    </>
  ),
  cart: (
    <>
      <path d="M2 3h2.5l2.2 12.2a2 2 0 0 0 2 1.8h9.1a2 2 0 0 0 2-1.6L21.5 7H5.3" />
      <circle cx="9" cy="21" r="1" />
      <circle cx="18" cy="21" r="1" />
    </>
  ),
  chat: (
    <path d="M12 3c-5.2 0-9.5 3.6-9.5 8 0 2.2 1.1 4.2 2.9 5.7L4 21l5.1-2.4c.9.3 1.9.4 2.9.4 5.2 0 9.5-3.6 9.5-8S17.2 3 12 3Z" />
  ),
  bag: (
    <>
      <path d="M5 8h14l1 13H4L5 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  "user-circle": (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="9" r="3" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  store: (
    <>
      <path d="M3 10 5 3h14l2 7M4 10v11h16V10M9 21v-7h6v7" />
      <path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 10l1-7m5 7-1-7" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18M7 16v-5m5 5V7m5 9V4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
  ),
  share: (
    <>
      <path d="M12 15V3m-4 4 4-4 4 4" />
      <path d="M8 11H5v10h14V11h-3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  back: <path d="m15 18-6-6 6-6" />,
  filter: (
    <>
      <path d="M4 7h16M7 12h10M10 17h4" />
    </>
  ),
  star: (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12 4 4L19 6" />,
  location: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  box: (
    <>
      <path d="m4 7 8-4 8 4-8 4-8-4Z" />
      <path d="M4 7v10l8 4 8-4V7M12 11v10" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" />
    </>
  ),
  shirt: <path d="m8 4-5 4 3 4 2-1v10h8V11l2 1 3-4-5-4c-1 2-7 2-8 0Z" />,
  sparkle: (
    <path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10Z" />
  ),
};
export function Icon({
  name,
  size = 24,
  className,
  filled = false,
}: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name] ?? paths.box}
    </svg>
  );
}
