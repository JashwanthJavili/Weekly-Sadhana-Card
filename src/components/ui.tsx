"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EyeOff, KeyIcon, Lock, ShieldCheck, Smartphone, UserIcon } from "@/components/icons";
import { CloseFab, Popover } from "@/components/pickers";
import { formatWeekRange } from "@/lib/dates";
import { opensAt } from "@/lib/useUnlock";

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
        {step(1, <>Choose a <b className="text-ink">day</b>, then tap any item to fill it in.</>)}
        {step(2, <>For times and durations, <b className="text-ink">scroll the wheels</b> and tap Done.</>)}
        {step(3, <>For Japa class, tap <b className="text-ink">Yes</b> or <b className="text-ink">No</b>. For Seva and the reflections, simply type.</>)}
        {step(4, <>Your card saves automatically. After the week ends, on Monday, tap <b className="text-ink">Send to mentor</b>.</>)}
      </ol>
      <PrivacyBadge />
    </div>
  );
}

/** Detailed explanation of how cards are protected. */
function SecurityContent() {
  const item = (icon: ReactNode, title: string, text: ReactNode) => (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">{icon}</span>
      <span className="min-w-0 leading-snug">
        <b className="block text-[14px] font-semibold text-ink">{title}</b>
        <span className="mt-0.5 block text-[13px] text-ink/65">{text}</span>
      </span>
    </li>
  );
  return (
    <div className="max-w-sm lg:max-h-[65vh] lg:overflow-y-auto lg:pr-1">
      <p className="mb-3 text-[13.5px] leading-relaxed text-ink/70">Your Sadhana Card is personal. It is protected in the following ways.</p>
      <ul className="divide-y divide-black/[0.06]">
        {item(
          <ShieldCheck className="h-[18px] w-[18px]" />,
          "Encrypted on your device",
          "Your entries are encrypted on your phone before they are saved, using AES-256, a standard trusted by banks.",
        )}
        {item(
          <EyeOff className="h-[18px] w-[18px]" />,
          "Stored securely",
          "Only encrypted data is stored online. It cannot be read without your personal key, including by the app administrators.",
        )}
        {item(
          <UserIcon className="h-[18px] w-[18px]" />,
          "Access only to you",
          "Each account can open only its own cards. Signing in is optional; you are given a private account automatically.",
        )}
        {item(
          <KeyIcon className="h-[18px] w-[18px]" />,
          "Your personal key",
          "The key that opens your cards is kept on this device. If you set a card password, a protected copy of the key is saved to your account.",
        )}
        {item(
          <Smartphone className="h-[18px] w-[18px]" />,
          "Using another device",
          "To open your cards on a new phone, or after clearing your browser, sign in with Google and set a card password from your account. Please keep the password safe, as it cannot be recovered.",
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
        <b className="block text-ink">Your data is protected</b>
        <span className="text-ink/60">Your entries are encrypted and can be viewed only by you.</span>
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
        <h2 id="privacy-title" className="relative mt-4 font-serif text-[23px] font-bold text-ink">
          Your data is protected
        </h2>
        <p className="relative mt-1 text-[13px] text-ink/55">Week of {weekLabel}</p>

        <ul className="mt-5 space-y-3.5 text-left">
          {point(<ShieldCheck className="h-5 w-5" />, "Encrypted on your device", "Your entries are encrypted before they are saved.")}
          {point(<EyeOff className="h-5 w-5" />, "Private to you", "The contents of your card can be viewed only by you.")}
          {point(<Smartphone className="h-5 w-5" />, "Access on any device", "Sign in with Google and set a card password to open your cards on another device.")}
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


const longDay = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

/**
 * Shown while Download / Send to mentor are not yet available:
 * "Ready to send on Mon, 23 Nov · After the week is complete · 3 days 7 hours to go  (i)".
 * The (i) explains why, in plain words.
 */
export function UnlockNote({ weekStart, day, left, layout }: { weekStart: string; day: string; left: string; layout: "bar" | "inline" }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const at = opensAt(weekStart);
  const when = at ? longDay.format(at) : day;

  const info = (size: string) => (
    <button
      type="button"
      aria-label="Why can't I send my card yet?"
      aria-haspopup="dialog"
      onClick={(e) => {
        const el = e.currentTarget;
        setAnchor((a) => (a ? null : el));
      }}
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-brand hover:bg-white active:bg-white`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-5M12 8h.01" strokeLinecap="round" />
      </svg>
    </button>
  );

  const step = (n: number, text: ReactNode) => (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[12px] font-bold text-brand">{n}</span>
      <span className="pt-0.5">{text}</span>
    </li>
  );

  return (
    <>
      {layout === "bar" ? (
        <div className="mx-auto mb-2 flex max-w-md items-center gap-2.5 rounded-2xl bg-band py-1.5 pr-1 pl-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand shadow-sm">
            <Lock className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[13px] font-semibold text-ink max-[359px]:text-[12.5px]">
              Ready to send on <span className="whitespace-nowrap">{day}</span>
            </span>
            <span className="block text-[11.5px] text-ink/60">{left} to go</span>
          </span>
          {info("h-10 w-10")}
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-band py-0.5 pr-0.5 pl-3" title={`${left} to go`}>
          <Lock className="h-3.5 w-3.5 shrink-0 text-brand" />
          <span className="hidden text-[12.5px] leading-none whitespace-nowrap text-ink/70 xl:inline">
            Ready to send on <b className="text-ink">{day}</b>
          </span>
          <span className="text-[12.5px] leading-none whitespace-nowrap text-ink/70 xl:hidden">
            <b className="text-ink">{day}</b>
          </span>
          {info("h-8 w-8")}
        </div>
      )}
      <Popover anchor={anchor} open={!!anchor} onClose={() => setAnchor(null)} onDone={() => setAnchor(null)} title="Why can't I send my card yet?">
        <div className="max-w-sm space-y-3 text-[14px] leading-relaxed text-ink/75">
          <p>
            Your Sadhana Card is a report of the <b className="text-ink">whole week, Monday to Sunday</b>. So that your mentor can see the complete
            week, <b className="text-ink">Download</b> and <b className="text-ink">Send to mentor</b> become available once the week is complete.
          </p>
          <div className="rounded-2xl bg-band p-3 text-center">
            <div className="text-[12px] text-ink/55">This card ({formatWeekRange(weekStart)}) will be ready to send on</div>
            <div className="text-[17px] font-bold text-brand">{when}, 12:00 AM</div>
            <div className="text-[12px] text-ink/55">{left} to go</div>
          </div>
          <ol className="space-y-2">
            {step(1, "Keep filling in each day until Sunday night. Everything saves by itself.")}
            {step(2, <>On Monday, open this card and tap <b className="text-ink">Send to mentor</b>.</>)}
            {step(3, "Choose WhatsApp, then your mentor's chat. Your card is attached as a picture.")}
          </ol>
          <p className="text-[12.5px] text-ink/55">Cards for weeks that are already over can be sent any time.</p>
        </div>
      </Popover>
    </>
  );
}
