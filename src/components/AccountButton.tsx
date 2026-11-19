"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useAccount } from "@/components/AccountProvider";
import { ChevronRight, Cloud, GoogleG, KeyIcon, LogOut } from "@/components/icons";
import { Popover } from "@/components/pickers";
import { cancelGoogleSignIn, requestSetup, signInWithGoogle, signOut } from "@/lib/account";

function Avatar({ name, photoURL, size = "h-9 w-9" }: { name: string; photoURL: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (photoURL && !broken) {
    return <img src={photoURL} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-brand/10 font-serif text-sm font-bold text-brand`}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/**
 * Home-page account row.
 * Guests: one tap on "Continue with Google" signs in (optional).
 * Signed in: photo + name; tap for account details and sign out.
 */
export function AccountRow() {
  const acc = useAccount();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const user = acc.user;
  const google = !!user && !user.isAnonymous;

  // Came back to the page without finishing in the Google window? Don't stay stuck on "Signing in…".
  useEffect(() => {
    if (!busy || google) return;
    let t: number | undefined;
    const onBack = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(t);
      t = window.setTimeout(cancelGoogleSignIn, 2500);
    };
    window.addEventListener("focus", onBack);
    document.addEventListener("visibilitychange", onBack);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("focus", onBack);
      document.removeEventListener("visibilitychange", onBack);
    };
  }, [busy, google]);

  const doGoogle = async () => {
    setBusy(true);
    setError(null);
    const r = await signInWithGoogle();
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  const doSignOut = async () => {
    setBusy(true);
    const r = await signOut();
    setBusy(false);
    if (r.ok) setAnchor(null);
    else setError(r.error);
  };

  if (!user) return <div className="h-[58px] shrink-0 animate-pulse rounded-2xl bg-white/70" />;

  if (!google) {
    return (
      <div className="shrink-0">
        <button
          type="button"
          onClick={() => (busy ? cancelGoogleSignIn() : void doGoogle())}
          className="flex w-full items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 text-left shadow-sm ring-1 ring-black/5 transition-colors hover:bg-band disabled:opacity-60"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-black/10">
            <GoogleG className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[14px] font-semibold text-ink">{busy ? "Signing in… tap to cancel" : "Continue with Google"}</span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-ink/65"><b className="font-semibold text-brand">Optional</b> · keep your cards in your Google account</span>
          </span>
          <ChevronRight className="h-4 w-4 text-ink/30" />
        </button>
        {error && <p className="mt-1.5 px-1 text-[12px] text-rose-600">{error}</p>}
      </div>
    );
  }

  const name = user.name || user.email;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={(e) => {
          const el = e.currentTarget;
          setError(null);
          setConfirmOut(false);
          setAnchor((a) => (a ? null : el));
        }}
        className="flex w-full shrink-0 items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 text-left shadow-sm ring-1 ring-black/5 transition-colors hover:bg-band"
      >
        <Avatar name={name} photoURL={user.photoURL} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[14px] font-semibold text-ink">{name}</span>
          <span className="flex items-center gap-1 text-[12px] text-emerald-700">
            <Cloud className="h-3.5 w-3.5" /> Saved to your account
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-ink/30" />
      </button>

      <Popover anchor={anchor} open={!!anchor} onClose={busy ? () => undefined : () => setAnchor(null)} title="Your account">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3">
            <Avatar name={name} photoURL={user.photoURL} size="h-12 w-12" />
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{user.name || "Signed in"}</div>
              <div className="truncate text-[13px] text-ink/55">{user.email}</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-band p-3 text-[13px] leading-snug text-ink/70">
            Your cards are saved to this Google account and stay end-to-end encrypted.
            {acc.phase === "ready" ? (
              <span className="mt-1 block font-medium text-emerald-700">Protected with your passphrase: they open on any device.</span>
            ) : (
              <span className="mt-1 block font-medium text-amber-700">Not protected yet: they open only on this phone.</span>
            )}
          </div>

          {acc.phase === "needs-setup" && (
            <button
              type="button"
              onClick={() => {
                setAnchor(null);
                requestSetup();
              }}
              className="mt-2 flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[13px] hover:bg-band"
            >
              <KeyIcon className="h-4 w-4 shrink-0 text-brand" />
              <span className="flex-1">
                <b className="block text-ink">Protect your cards</b>
                <span className="text-ink/55">Set a passphrase to open them on any device</span>
              </span>
              <ChevronRight className="h-4 w-4 text-ink/30" />
            </button>
          )}

          {confirmOut ? (
            <div className="mt-3 rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-200">
              <p className="text-[13px] leading-snug text-rose-900">Sign out of this device? Your cards stay in your account.</p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => setConfirmOut(false)} className="h-10 rounded-xl border border-line bg-white text-sm font-semibold text-ink">
                  Cancel
                </button>
                <button type="button" disabled={busy} onClick={() => void doSignOut()} className="h-10 rounded-xl bg-rose-500 text-sm font-semibold text-white disabled:opacity-60">
                  {busy ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmOut(true)}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-ink/75 hover:bg-band"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          )}
          {error && <p className="mt-3 text-center text-sm text-rose-600">{error}</p>}
        </div>
      </Popover>
    </>
  );
}
