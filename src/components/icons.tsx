// Small line icons (stroke = currentColor).
type P = { className?: string };
const base = "shrink-0";
const svg = (d: React.ReactNode, className = "h-5 w-5") => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className}`} aria-hidden>
    {d}
  </svg>
);

export const ChevronLeft = ({ className }: P) => svg(<path d="m15 18-6-6 6-6" />, className);
export const ChevronRight = ({ className }: P) => svg(<path d="m9 18 6-6-6-6" />, className);
export const ChevronDown = ({ className }: P) => svg(<path d="m6 9 6 6 6-6" />, className);
export const Check = ({ className }: P) => svg(<path d="M20 6 9 17l-5-5" />, className);
export const Download = ({ className }: P) =>
  svg(
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>,
    className,
  );
export const Pencil = ({ className }: P) =>
  svg(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>,
    className,
  );
export const FileIcon = ({ className }: P) =>
  svg(
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </>,
    className,
  );
export const ImageIcon = ({ className }: P) =>
  svg(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </>,
    className,
  );
export const Printer = ({ className }: P) =>
  svg(
    <>
      <path d="M6 9V3h12v6" />
      <rect x="6" y="14" width="12" height="7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
    </>,
    className,
  );
export const Home = ({ className }: P) =>
  svg(
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9" />
    </>,
    className,
  );
export const Lock = ({ className }: P) =>
  svg(
    <>
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>,
    className,
  );
export const ShieldCheck = ({ className }: P) =>
  svg(
    <>
      <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>,
    className,
  );
export const EyeOff = ({ className }: P) =>
  svg(
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4.2M6.6 6.6A13 13 0 0 0 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 4.4-1.1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>,
    className,
  );
export const Smartphone = ({ className }: P) =>
  svg(
    <>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </>,
    className,
  );
export const KeyIcon = ({ className }: P) =>
  svg(
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2" />
    </>,
    className,
  );
export const UserIcon = ({ className }: P) =>
  svg(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>,
    className,
  );
export const XIcon = ({ className }: P) => svg(<path d="M18 6 6 18M6 6l12 12" />, className);
export const Trash = ({ className }: P) =>
  svg(
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </>,
    className,
  );
export const Flame = ({ className }: P) =>
  svg(<path d="M12 22c4 0 7-2.7 7-6.8 0-3.2-2-5.7-3.6-7.4-.4 1.8-1.5 3-2.6 3.4.2-3.3-1.2-6.4-4.3-8.2.3 3-1.3 5-2.8 6.8C4.6 11.2 5 12.9 5 15.2 5 19.3 8 22 12 22Z" />, className);
export const Share = ({ className }: P) =>
  svg(
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </>,
    className,
  );
export const LogOut = ({ className }: P) =>
  svg(
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>,
    className,
  );
export const Cloud = ({ className }: P) => svg(<path d="M17.5 19H7a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 11 4 4 0 0 1 17.5 19Z" />, className);

/** Google "G" logo (brand colours). */
export const GoogleG = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 48 48" className={`shrink-0 ${className}`} aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);
export const MoreVertical = ({ className }: P) =>
  svg(
    <>
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </>,
    className,
  );
