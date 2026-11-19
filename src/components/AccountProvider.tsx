"use client";

import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { KeyIcon, Lock, ShieldCheck } from "@/components/icons";
import { DialogBadge, Modal, PassphraseInput } from "@/components/Modal";
import {
  getServerSnapshot,
  getSnapshot,
  initAccount,
  requestSetup,
  resetWithNewPassphrase,
  setupPassphrase,
  signOut,
  subscribe,
  unlock,
  type AccountSnapshot,
} from "@/lib/account";

export function useAccount(): AccountSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Signs the visitor in (privately) and shows the passphrase dialogs when needed. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const acc = useAccount();
  const [laterAt, setLaterAt] = useState(-1); // setupRequest value when "Later" was pressed

  useEffect(() => {
    void initAccount();
  }, []);

  const google = !!acc.user && !acc.user.isAnonymous;
  // The passphrase is optional: only shown when asked for from the account sheet.
  const showSetup = google && acc.phase === "needs-setup" && acc.setupRequest > 0 && laterAt !== acc.setupRequest;

  // Once per account: a gentle reminder (on the dashboard) to protect the cards with a passphrase.
  const [askProtect, setAskProtect] = useState(false);
  const uid = acc.user?.uid;
  useEffect(() => {
    if (!google || acc.phase !== "needs-setup" || !uid || acc.setupRequest > 0) return;
    if (window.location.pathname !== "/") return;
    const key = `sadhana-card:protect-asked:${uid}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      return; // storage blocked: don't risk asking every time
    }
    const t = window.setTimeout(() => setAskProtect(true), 1200); // let the dashboard settle first
    return () => window.clearTimeout(t);
  }, [google, acc.phase, uid, acc.setupRequest]);

  const closeProtect = (setUp: boolean) => {
    try {
      localStorage.setItem(`sadhana-card:protect-asked:${uid}`, String(Date.now()));
    } catch {
      /* ignore */
    }
    setAskProtect(false);
    if (setUp) requestSetup();
  };

  return (
    <>
      {children}
      {google && acc.phase === "locked" && <UnlockDialog email={acc.user!.email} />}
      {showSetup && <SetupDialog onLater={() => setLaterAt(acc.setupRequest)} />}
      {askProtect && !showSetup && acc.phase === "needs-setup" && <ProtectPrompt onAnswer={closeProtect} />}
    </>
  );
}

const MIN_LEN = 8;

/** One-time reminder: without a passphrase, cards live only on this device. */
function ProtectPrompt({ onAnswer }: { onAnswer: (setUp: boolean) => void }) {
  const id = useId();
  return (
    <Modal open onClose={() => onAnswer(false)} labelledBy={id}>
      <div className="text-center">
        <DialogBadge>
          <ShieldCheck className="h-6 w-6" />
        </DialogBadge>
        <h2 id={id} className="mt-4 font-serif text-[22px] font-bold text-ink">
          Protect your cards
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink/65">
          Right now your cards can only be opened on <b className="text-ink">this phone</b>. If you change phones or clear your browser, they can&apos;t be
          opened again.
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink/65">Set a card password once, and you can open your cards on any device by signing in.</p>
      </div>
      <button
        type="button"
        onClick={() => onAnswer(true)}
        className="mt-5 h-12 w-full rounded-2xl bg-brand text-[15px] font-semibold text-white shadow-sm hover:bg-brand-dark"
      >
        Set a card password
      </button>
      <button type="button" onClick={() => onAnswer(false)} className="mt-2 h-10 w-full text-sm font-medium text-ink/55">
        Not now
      </button>
      <p className="text-center text-[12px] text-ink/45">You can do this any time from your account (tap your name).</p>
    </Modal>
  );
}

function strength(p: string): { label: string; tone: string; width: string } {
  let score = 0;
  if (p.length >= MIN_LEN) score++;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (p.length < MIN_LEN) return { label: `At least ${MIN_LEN} characters`, tone: "bg-rose-400", width: "20%" };
  if (score <= 2) return { label: "Okay", tone: "bg-amber-400", width: "50%" };
  if (score <= 3) return { label: "Good", tone: "bg-emerald-400", width: "75%" };
  return { label: "Strong", tone: "bg-emerald-500", width: "100%" };
}

function NewPassphraseFields(props: { p1: string; p2: string; setP1: (v: string) => void; setP2: (v: string) => void; onEnter: () => void }) {
  const { p1, p2, setP1, setP2, onEnter } = props;
  const s = strength(p1);
  return (
    <div className="space-y-3 text-left">
      <PassphraseInput label="New card password" value={p1} onChange={setP1} autoFocus autoComplete="new-password" />
      {p1 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
            <div className={`h-full ${s.tone} transition-all`} style={{ width: s.width }} />
          </div>
          <span className="text-[11px] text-ink/55">{s.label}</span>
        </div>
      )}
      <PassphraseInput label="Type it again" value={p2} onChange={setP2} autoComplete="new-password" onEnter={onEnter} />
      {p2 && p1 !== p2 && <p className="text-[12px] text-rose-600">The two card passwords don&apos;t match.</p>}
    </div>
  );
}

function SetupDialog({ onLater }: { onLater: () => void }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const valid = p1.length >= MIN_LEN && p1 === p2;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const r = await setupPassphrase(p1);
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  return (
    <Modal open onClose={busy ? undefined : onLater} labelledBy={id}>
      <div className="text-center">
        <DialogBadge>
          <Lock className="h-6 w-6" />
        </DialogBadge>
        <h2 id={id} className="mt-4 font-serif text-[22px] font-bold text-ink">
          Create your card password
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink/65">
          With this password, you can open your cards on any phone or computer after signing in. Only you will know it.
        </p>
      </div>
      <div className="mt-5">
        <NewPassphraseFields p1={p1} p2={p2} setP1={setP1} setP2={setP2} onEnter={submit} />
      </div>
      <div className="mt-4 rounded-xl bg-amber-50 p-3 text-[12.5px] leading-snug text-amber-900 ring-1 ring-amber-200">
        <b>Write it down.</b> Nobody can reset it for you, not even the people who run this app. Without it, your cards can&apos;t be opened on a new phone.
      </div>
      {error && <p className="mt-3 text-center text-sm text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={!valid || busy}
        className="mt-5 h-12 w-full rounded-2xl bg-brand text-[15px] font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? "Saving your password…" : "Create password"}
      </button>
      <button type="button" onClick={onLater} disabled={busy} className="mt-2 h-10 w-full text-sm font-medium text-ink/55 disabled:opacity-50">
        Later
      </button>
    </Modal>
  );
}

function UnlockDialog({ email }: { email: string }) {
  const [mode, setMode] = useState<"unlock" | "reset">("unlock");
  const [pass, setPass] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
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
    if (p1.length < MIN_LEN || p1 !== p2 || busy) return;
    setBusy(true);
    setError(null);
    const r = await resetWithNewPassphrase(p1);
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
              Unlock your cards
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink/65">
              Signed in as <b className="text-ink">{email}</b>. Enter your card password to open your cards on this device.
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
            {busy ? "Unlocking…" : "Unlock"}
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
              Forgot card password?
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
              Without your old card password, nobody can open your saved cards. Starting fresh <b className="text-rose-600">deletes them</b>{" "}
              and sets a new card password.
            </p>
          </div>
          <div className="mt-5">
            <NewPassphraseFields p1={p1} p2={p2} setP1={setP1} setP2={setP2} onEnter={doReset} />
          </div>
          {error && <p className="mt-3 text-center text-sm text-rose-600">{error}</p>}
          <button
            type="button"
            onClick={doReset}
            disabled={p1.length < MIN_LEN || p1 !== p2 || busy}
            className="mt-5 h-12 w-full rounded-2xl bg-rose-500 text-[15px] font-semibold text-white shadow-sm hover:bg-rose-600 disabled:opacity-50"
          >
            {busy ? "Please wait…" : "Delete old cards and start fresh"}
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
