"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EyeOff, FileIcon, ImageIcon, KeyIcon, Lock, ShieldCheck, Smartphone, UserIcon } from "@/components/icons";
import { CloseFab, Popover } from "@/components/pickers";

/** Small round "i" button that opens help text (popover on desktop, bottom sheet on phones). */
export function InfoButton({
  className = "",
  light = false,
  topic = "help",
}: {
  className?: string;
  light?: boolean;
  topic?: "help" | "security";
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button
        type="button"
        aria-label={topic === "security" ? "How your data is secured" : "How to fill your card"}
        aria-haspopup="dialog"
        onClick={(e) => {
          const el = e.currentTarget;
          setAnchor((a) => (a ? null : el));
        }}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${light ? "text-white/90 hover:bg-white/15" : "text-brand hover:bg-band"} ${className}`}
      >
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-5M12 8h.01" strokeLinecap="round" />
        </svg>
      </button>
      <Popover
        anchor={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        onDone={() => setAnchor(null)}
        title={topic === "security" ? "How your data is secured" : "How to fill your card"}
      >
        {topic === "security" ? <SecurityContent /> : <HelpContent />}
      </Popover>
    </>
  );
}

function HelpContent() {
  const step = (n: number, text: ReactNode) => (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">{n}</span>
      <span className="pt-0.5 text-ink/75">{text}</span>
    </li>
  );
  return (
    <div className="max-w-sm space-y-4 text-[14px]">
      <ol className="space-y-3">
        {step(1, <>Pick a <b className="text-ink">day</b>, then tap any item to fill it.</>)}
        {step(2, <>For times, <b className="text-ink">scroll the wheels</b> and tap Done.</>)}
        {step(3, <>Japa class: tap <b className="text-ink">Yes</b> or <b className="text-ink">No</b>. Seva &amp; reflections: just type.</>)}
        {step(4, <>It saves by itself. At week end, tap <b className="text-ink">Complete</b> and download.</>)}
      </ol>
      <PrivacyBadge />
    </div>
  );
}

/** Detailed explanation of how cards are protected. */
function SecurityContent() {
  const item = (icon: ReactNode, title: string, text: ReactNode) => (
    <li className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">{icon}</span>
      <span className="leading-snug">
        <b className="block text-[14px] text-ink">{title}</b>
        <span className="text-[13px] text-ink/65">{text}</span>
      </span>
    </li>
  );
  return (
    <div className="max-h-[65vh] max-w-sm overflow-y-auto pr-1">
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand to-[#14a3a3] p-3.5 text-white">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Lock className="h-5 w-5" />
        </span>
        <span className="text-[13px] leading-snug">
          <b className="block text-[15px]">End-to-end encrypted</b>
          Only you can read your Sadhana Cards.
        </span>
      </div>
      <ul className="space-y-4">
        {item(
          <ShieldCheck className="h-5 w-5" />,
          "Locked on your device",
          <>Before anything is saved, your card is encrypted right here in your browser with <b>AES-256</b> — the same strength banks use.</>,
        )}
        {item(
          <KeyIcon className="h-5 w-5" />,
          "Your key stays with you",
          "A secret key is created just for you and kept on this device so it can't be copied out. If you choose to add a passphrase, a copy is saved online locked with it — and your passphrase never leaves your device.",
        )}
        {item(
          <EyeOff className="h-5 w-5" />,
          "The server only sees scrambled text",
          "What is stored online cannot be read by anyone — not the app owner, and not the cloud provider.",
        )}
        {item(
          <UserIcon className="h-5 w-5" />,
          "Only your account can open them",
          "Without signing in you get a private account automatically. With Google sign-in, your cards follow you to any device. Either way, security rules let only you reach your cards.",
        )}
        {item(
          <Smartphone className="h-5 w-5" />,
          "Good to know",
          "Not signed in? Your cards live only in this browser — sign in with Google to keep them in your account. To open them on another device, add a passphrase from your account (optional) — nobody can reset it, so remember it.",
        )}
      </ul>
    </div>
  );
}

/** Compact "private" strip used in the help sheet. */
export function PrivacyBadge() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand/10 to-brand/5 p-3 ring-1 ring-brand/15">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-sm">
        <Lock className="h-[18px] w-[18px]" />
      </span>
      <span className="text-[13px] leading-snug">
        <b className="block text-ink">End-to-end encrypted</b>
        <span className="text-ink/60">Only you can read your card — not even the app owner.</span>
      </span>
    </div>
  );
}

/** Shown once per week when a card is opened: a friendly reminder that the card is private. */
export function PrivacyNotice({ weekStart, weekLabel }: { weekStart: string; weekLabel: string }) {
  const storageKey = `sadhana-card:privacy-seen:${weekStart}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(storageKey) === "1";
    } catch {
      /* storage unavailable: show it */
    }
    setOpen(!seen);
  }, [storageKey]);

  const close = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  const point = (icon: ReactNode, title: string, text: string) => (
    <li className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">{icon}</span>
      <span className="leading-snug">
        <b className="block text-[14px] text-ink">{title}</b>
        <span className="text-[13px] text-ink/60">{text}</span>
      </span>
    </li>
  );

  return createPortal(
    <div className="modal-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-black/75 sm:items-center sm:p-4" onClick={close}>
      <div className="modal-panel relative w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
      <CloseFab onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        className="relative w-full overflow-hidden rounded-t-3xl bg-white px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center shadow-2xl sm:rounded-3xl sm:pb-6"
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-brand/10 to-transparent" />
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand to-[#14a3a3] text-white shadow-lg shadow-brand/30">
          <Lock className="h-7 w-7" />
        </div>
        <h2 id="privacy-title" className="relative mt-4 font-serif text-[24px] font-bold text-ink">
          Your card is private
        </h2>
        <p className="relative mt-1 text-[13px] text-ink/55">Week of {weekLabel}</p>

        <ul className="mt-5 space-y-3.5 text-left">
          {point(<ShieldCheck className="h-5 w-5" />, "Encrypted on your device", "Everything you write is locked before it is saved.")}
          {point(<EyeOff className="h-5 w-5" />, "Only you can read it", "Not even the people who run this app can see it.")}
          {point(<Smartphone className="h-5 w-5" />, "Kept in your account", "Sign in with Google on the home screen to keep your cards safe.")}
        </ul>

        <button
          type="button"
          autoFocus
          onClick={close}
          className="mt-6 h-12 w-full rounded-2xl bg-brand text-[15px] font-semibold text-white shadow-sm outline-none transition-colors hover:bg-brand-dark focus-visible:ring-4 focus-visible:ring-brand/30"
        >
          Got it
        </button>
      </div>
      </div>
    </div>,
    document.body,
  );
}

/** Download menu: PDF / image / print. */
/** A button that first asks "PDF or Image?", then calls onPick with the choice. */
export function FormatMenu(props: {
  title: string;
  disabled?: boolean;
  onPick: (format: "pdf" | "image") => void;
  className: string;
  children: ReactNode;
}) {
  const { title, disabled, onPick, className, children } = props;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const pick = (f: "pdf" | "image") => {
    setAnchor(null);
    onPick(f);
  };
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={(e) => {
          const el = e.currentTarget;
          setAnchor((a) => (a ? null : el));
        }}
        className={className}
      >
        {children}
      </button>
      <Popover anchor={anchor} open={!!anchor} onClose={() => setAnchor(null)} title={title}>
        <FormatOptions onPick={pick} />
      </Popover>
    </>
  );
}

/** The two choices shown in a "PDF or Image?" sheet. */
export function FormatOptions({ onPick }: { onPick: (format: "pdf" | "image") => void }) {
  const opt = (f: "pdf" | "image", icon: ReactNode, label: string, sub: string) => (
    <button type="button" onClick={() => onPick(f)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-band active:bg-band">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">{icon}</span>
      <span>
        <span className="block font-semibold text-ink">{label}</span>
        <span className="block text-xs text-ink/55">{sub}</span>
      </span>
    </button>
  );
  return (
    <div className="min-w-[240px] space-y-1">
      {opt("image", <ImageIcon />, "Image", "Recommended · easy to view on any phone")}
      {opt("pdf", <FileIcon />, "PDF", "A4 page, best for printing")}
    </div>
  );
}
