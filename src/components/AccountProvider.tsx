"use client";

import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { KeyIcon } from "@/components/icons";
import { DialogBadge, Modal, PassphraseInput } from "@/components/Modal";
import { getServerSnapshot, getSnapshot, initAccount, signOut, startFresh, subscribe, unlock, type AccountSnapshot } from "@/lib/account";

export function useAccount(): AccountSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Signs the visitor in (privately). Google accounts sync automatically; the only dialog left is
 * for older accounts that were protected with a card password, the first time they open on a device.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const acc = useAccount();

  useEffect(() => {
    void initAccount();
  }, []);

  const google = !!acc.user && !acc.user.isAnonymous;
  return (
    <>
      {children}
      {google && acc.phase === "locked" && <UnlockDialog email={acc.user!.email} />}
    </>
  );
}

/** Older accounts only: enter the card password once on this device; after that the account syncs by itself. */
function UnlockDialog({ email }: { email: string }) {
  const [mode, setMode] = useState<"unlock" | "reset">("unlock");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const doUnlock = async () => {
    if (!pass || busy) return;
    setBusy(true);
    setError(null);
    const r = await unlock(pass);
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  const doReset = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await startFresh();
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  const doSignOut = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
  };

  return (
    <Modal open labelledBy={id}>
      {mode === "unlock" ? (
        <>
          <div className="text-center">
            <DialogBadge>
              <KeyIcon className="h-6 w-6" />
            </DialogBadge>
            <h2 id={id} className="mt-4 font-serif text-[22px] font-bold text-ink">
              Enter your card password
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink/65">
              Signed in as <b className="text-ink">{email}</b>. Your cards were protected with a card password earlier. Please enter it once; after
              this, your cards will open automatically on every device.
            </p>
          </div>
          <div className="mt-5">
            <PassphraseInput label="Card password" value={pass} onChange={setPass} autoFocus onEnter={doUnlock} />
          </div>
          {error && <p className="mt-3 text-center text-sm text-rose-600">{error}</p>}
          <button
            type="button"
            onClick={doUnlock}
            disabled={!pass || busy}
            className="mt-5 h-12 w-full rounded-2xl bg-brand text-[15px] font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? "Opening your cards…" : "Continue"}
          </button>
          <div className="mt-3 flex items-center justify-between text-sm">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setMode("reset");
              }}
              className="font-medium text-brand"
            >
              Forgot password?
            </button>
            <button type="button" disabled={busy} onClick={doSignOut} className="font-medium text-ink/55">
              Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-center">
            <DialogBadge tone="danger">
              <KeyIcon className="h-6 w-6" />
            </DialogBadge>
            <h2 id={id} className="mt-4 font-serif text-[22px] font-bold text-ink">
              Start fresh?
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink/65">
              Without the card password, your earlier cards cannot be opened. Starting fresh <b className="text-rose-600">deletes them</b>, and your new
              cards will open automatically on every device.
            </p>
          </div>
          {error && <p className="mt-3 text-center text-sm text-rose-600">{error}</p>}
          <button
            type="button"
            onClick={doReset}
            disabled={busy}
            className="mt-5 h-12 w-full rounded-2xl bg-rose-500 text-[15px] font-semibold text-white shadow-sm hover:bg-rose-600 disabled:opacity-50"
          >
            {busy ? "Please wait…" : "Delete earlier cards and start fresh"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError(null);
              setMode("unlock");
            }}
            className="mt-2 h-10 w-full text-sm font-medium text-ink/55"
          >
            Back
          </button>
        </>
      )}
    </Modal>
  );
}
