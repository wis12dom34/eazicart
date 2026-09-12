type IconProps = { name: string; size?: number; className?: string };
const paths: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9M9 20v-6h6v6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  reels: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m10 9 6 3-6 3Z" />
    </>
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
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
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
export function Icon({ name, size = 24, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.box}
    </svg>
  );
}
