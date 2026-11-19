/**
 * Who is signed in, and the encryption key for their cards.
 *
 * - Everyone starts with a private anonymous account and a key that lives only on this device.
 * - "Sign in with Google" (optional) links that account to Google. The account's data key is then
 *   kept in the account record (`accountKey`, readable only by that account), so the cards open
 *   on every device the person signs in on, with nothing else to remember.
 * - Cards made before (with a device-only key, or an older passphrase) are moved to the account
 *   key automatically.
 *
 * This is a tiny external store (subscribe / getSnapshot) used with React's useSyncExternalStore.
 */
import type { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  linkWithPopup,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
  type OAuthCredential,
  type User,
} from "firebase/auth";
import { deleteField, getDoc, getDocFromServer, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { createDeviceKey, deleteStoredKey, importAccountKey, loadStoredKey, newAccountKey, storeKey, unwrapKey, type KeyWrap } from "./crypto";
import { authErrorMessage, getFirebase } from "./firebase";
import { decodeCard, decodeProfile, encodeCard, encodeProfile, readAllCards, readProfile, userRef, weekRef, weeksRef } from "./storage/firestoreCodec";
import type { Profile, WeekCard } from "./types";

export type Phase = "loading" | "ready" | "needs-setup" | "locked" | "error";

export interface AccountUser {
  uid: string;
  isAnonymous: boolean;
  name: string;
  email: string;
  photoURL: string;
}

export interface AccountSnapshot {
  phase: Phase;
  user: AccountUser | null;
  error: string | null;
  /** Changes whenever the account or its key changes — pages reload their data on change. */
  version: number;
  /** Bumped to ask the UI to show the passphrase setup again. */
  setupRequest: number;
}

export class LockedError extends Error {
  constructor() {
    super("Your cards are locked. Please enter your card password to open them.");
    this.name = "LockedError";
  }
}

export type Result = { ok: true } | { ok: false; error: string };

/* ───────── store ───────── */

const SERVER_SNAPSHOT: AccountSnapshot = { phase: "loading", user: null, error: null, version: 0, setupRequest: 0 };
let snap: AccountSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function set(patch: Partial<AccountSnapshot>) {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
}

export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const getSnapshot = () => snap;
export const getServerSnapshot = () => SERVER_SNAPSHOT;

/* ───────── internals ───────── */

let key: CryptoKey | null = null;
/** Cards from this device's anonymous account, waiting to be merged into a Google account. */
let pendingMerge: { cards: WeekCard[]; profile: Profile | null } | null = null;
/** The operation in progress; data access waits for it. */
let current: Promise<unknown> = Promise.resolve();
let started = false;

const toUser = (u: User): AccountUser => ({
  uid: u.uid,
  isAnonymous: u.isAnonymous,
  name: u.displayName ?? "",
  email: u.email ?? "",
  photoURL: u.photoURL ?? "",
});

async function fetchKeyWrap(uid: string): Promise<KeyWrap | null> {
  return ((await getDoc(userRef(uid))).data()?.keyWrap as KeyWrap | undefined) ?? null;
}

/* ───────── account key (Google accounts) ───────── */

/** This device already holds the account's key (so no server round-trip is needed on start). */
const syncedFlag = (uid: string) => `sadhana-card:account-key:${uid}`;
const isSynced = (uid: string) => {
  try {
    return localStorage.getItem(syncedFlag(uid)) === "1";
  } catch {
    return false;
  }
};
const markSynced = (uid: string, on: boolean) => {
  try {
    if (on) localStorage.setItem(syncedFlag(uid), "1");
    else localStorage.removeItem(syncedFlag(uid));
  } catch {
    /* ignore */
  }
};

/** Re-encrypt anything in this account that `target` can't read but one of `others` can. */
async function moveToKey(uid: string, target: CryptoKey, others: CryptoKey[]) {
  if (!others.length) return;
  const batch = writeBatch(getFirebase().db);
  let writes = 0;
  for (const d of (await getDocs(weeksRef(uid))).docs) {
    if (await decodeCard(uid, target, d.id, d.data())) continue;
    for (const k of others) {
      const card = await decodeCard(uid, k, d.id, d.data());
      if (card) {
        batch.set(weekRef(uid, d.id), await encodeCard(uid, target, card));
        writes++;
        break;
      }
    }
  }
  const userData = (await getDoc(userRef(uid))).data();
  if (userData?.profile && !(await decodeProfile(uid, target, userData))) {
    for (const k of others) {
      const profile = await decodeProfile(uid, k, userData);
      if (profile) {
        batch.set(userRef(uid), { uid, updatedAt: new Date().toISOString(), profile: await encodeProfile(uid, target, profile) }, { merge: true });
        writes++;
        break;
      }
    }
  }
  if (writes) await batch.commit();
}

/**
 * The key for a Google account, kept in the account record so every device can use it.
 * Creates it the first time (moving cards made with `fallbacks` over to it).
 * Needs the server; throws when offline so the caller can keep using the device key for now.
 */
async function accountKeyFor(uid: string, fallbacks: CryptoKey[]): Promise<CryptoKey> {
  const data = (await getDocFromServer(userRef(uid))).data();
  const existing = data?.accountKey;
  let key: CryptoKey;
  if (typeof existing === "string") {
    key = await importAccountKey(existing);
  } else if (data?.keyWrap && !fallbacks.length) {
    // An older account protected with a card password: its cards need that password once.
    throw new Error("needs-card-password");
  } else {
    const fresh = await newAccountKey();
    try {
      // The rules make the account key permanent once set, so two devices can't each set a different one.
      await setDoc(userRef(uid), { uid, updatedAt: new Date().toISOString(), accountKey: fresh.text }, { merge: true });
      key = fresh.key;
    } catch (e) {
      const now = (await getDocFromServer(userRef(uid))).data()?.accountKey;
      if (typeof now !== "string") throw e;
      key = await importAccountKey(now); // another device set it first
    }
  }
  await moveToKey(uid, key, fallbacks);
  await storeKey(uid, key);
  markSynced(uid, true);
  return key;
}

/** Make sure someone is signed in, then work out their key. */
async function establish() {
  const { auth } = getFirebase();
  await auth.authStateReady();
  let user = auth.currentUser;
  if (!user) {
    try {
      user = (await signInAnonymously(auth)).user;
    } catch (e) {
      throw new Error(authErrorMessage(e));
    }
  }

  const stored = (await loadStoredKey(user.uid)) ?? null;
  if (user.isAnonymous) {
    key = stored ?? (await createDeviceKey(user.uid));
    set({ phase: "ready", user: toUser(user), error: null, version: snap.version + 1 });
    return;
  }

  const uid = user.uid;
  // Fast path: this device already has the account key.
  if (stored && isSynced(uid)) {
    key = stored;
    set({ phase: "ready", user: toUser(user), error: null, version: snap.version + 1 });
    return;
  }

  try {
    key = await accountKeyFor(uid, stored ? [stored] : []);
    set({ phase: "ready", user: toUser(user), error: null, version: snap.version + 1 });
  } catch (e) {
    console.error(e);
    if (stored) {
      // Offline for now: keep working on this device; it syncs on the next start.
      key = stored;
      set({ phase: "ready", user: toUser(user), error: null, version: snap.version + 1 });
      return;
    }
    // Older accounts protected with a passphrase, opened for the first time on this device.
    const wrap = await fetchKeyWrap(uid).catch(() => null);
    if (wrap) {
      key = null;
      set({ phase: "locked", user: toUser(user), error: null, version: snap.version + 1 });
      return;
    }
    throw new Error("Sorry, we couldn't open your cards. Please check your internet connection and try again.");
  }
}

/** Run an account operation exclusively; data access waits for it. */
function run(op: () => Promise<void>): Promise<Result> {
  const p = current.catch(() => undefined).then(op);
  current = p;
  return p.then(
    () => ({ ok: true as const }),
    (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Sorry, something went wrong. Please try again." }),
  );
}

/** Copy cards from this device's anonymous account into the Google account (newer copy wins). */
async function applyMerge() {
  if (!pendingMerge || !key || !snap.user) return;
  const { uid } = snap.user;
  const { cards, profile } = pendingMerge;
  const existing = new Map((await readAllCards(uid, key)).map((c) => [c.weekStart, c]));
  const batch = writeBatch(getFirebase().db);
  let writes = 0;
  for (const card of cards) {
    const ex = existing.get(card.weekStart);
    if (!ex || ex.updatedAt < card.updatedAt) {
      batch.set(weekRef(uid, card.weekStart), await encodeCard(uid, key, card));
      writes++;
    }
  }
  if (profile) {
    const cur = await readProfile(uid, key);
    const merged: Profile = {
      name: cur?.name || profile.name,
      age: cur?.age || profile.age,
      mentor: cur?.mentor || profile.mentor,
      phone: cur?.phone || profile.phone,
    };
    batch.set(userRef(uid), { uid, updatedAt: new Date().toISOString(), profile: await encodeProfile(uid, key, merged) }, { merge: true });
    writes++;
  }
  if (writes) await batch.commit();
  pendingMerge = null;
}

/* ───────── public API ───────── */

export function initAccount() {
  if (started) return current;
  started = true;
  if (snap.phase === "error") set({ phase: "loading", error: null }); // retrying after a failed start
  current = establish().catch((e: unknown) => {
    started = false;
    set({ phase: "error", error: e instanceof Error ? e.message : "Sorry, we couldn't connect. Please check your internet connection and try again." });
  });
  return current;
}

/** Used by the storage layer before every read/write. */
export async function requireSession(): Promise<{ uid: string; key: CryptoKey }> {
  await initAccount();
  await current.catch(() => undefined);
  if (snap.phase === "locked") throw new LockedError();
  if (!key || !snap.user) throw new Error(snap.error ?? "Sorry, we couldn't connect. Please check your internet connection and try again.");
  return { uid: snap.user.uid, key };
}

let cancelPopup: (() => void) | null = null;

/** Stop waiting for the Google window (e.g. the person came back without finishing). */
export function cancelGoogleSignIn() {
  cancelPopup?.();
}

/**
 * The Google window runs outside the account queue: if the person leaves it open or
 * abandons it, nothing else (loading cards, saving) waits for it. If it still finishes
 * later, sign-in completes quietly.
 */
export async function signInWithGoogle(): Promise<Result> {
  const { auth } = getFirebase();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cur = auth.currentUser;

  // Open the window straight from the tap (no awaits before it, or browsers block the popup).
  const popup: Promise<{ cred: OAuthCredential | null }> = (async () => {
    if (cur?.isAnonymous) {
      try {
        // Same account, now with Google attached: all existing cards stay.
        await linkWithPopup(cur, provider);
        await cur.reload();
        return { cred: null };
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code !== "auth/credential-already-in-use" && code !== "auth/email-already-in-use") throw e;
        // This Google account already has cards (from another device): switch to it and merge.
        const cred = GoogleAuthProvider.credentialFromError(e as FirebaseError);
        if (!cred) throw e;
        return { cred };
      }
    }
    await signInWithPopup(auth, provider);
    return { cred: null };
  })();

  const finish = ({ cred }: { cred: OAuthCredential | null }) =>
    run(async () => {
      if (cred) {
        if (key && cur) pendingMerge = { cards: await readAllCards(cur.uid, key), profile: await readProfile(cur.uid, key) };
        try {
          await signInWithCredential(auth, cred);
        } catch (e) {
          pendingMerge = null;
          throw new Error(authErrorMessage(e));
        }
      }
      await establish();
      // Merge this device's cards now if we hold a key; if locked, it happens right after unlocking.
      if (snap.phase === "ready" || snap.phase === "needs-setup") await applyMerge();
    });

  const cancelled = new Promise<"cancelled">((resolve) => {
    cancelPopup = () => resolve("cancelled");
  });
  let outcome: { cred: OAuthCredential | null } | "cancelled";
  try {
    outcome = await Promise.race([popup, cancelled]);
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || code === "auth/user-cancelled") return { ok: true };
    return { ok: false, error: authErrorMessage(e) };
  } finally {
    cancelPopup = null;
  }
  if (outcome === "cancelled") {
    popup.then(finish, () => undefined);
    return { ok: true };
  }
  return finish(outcome);
}

export function unlock(passphrase: string): Promise<Result> {
  return run(async () => {
    if (!snap.user) throw new Error("Please sign in first.");
    const wrap = await fetchKeyWrap(snap.user.uid);
    if (!wrap) return establish();
    let k: CryptoKey;
    try {
      k = await unwrapKey(wrap, passphrase);
    } catch {
      throw new Error("That card password doesn't match. Please check it and try again.");
    }
    key = await accountKeyFor(snap.user.uid, [k]);
    set({ phase: "ready", version: snap.version + 1 });
    await applyMerge();
  });
}

/** Older passphrase accounts that forgot it: delete the unreadable cards and continue with the account key. */
export function startFresh(): Promise<Result> {
  return run(async () => {
    if (!snap.user || snap.user.isAnonymous) throw new Error("Please sign in first.");
    const { uid } = snap.user;
    const batch = writeBatch(getFirebase().db);
    (await getDocs(weeksRef(uid))).forEach((d) => batch.delete(d.ref));
    batch.set(userRef(uid), { uid, updatedAt: new Date().toISOString(), keyWrap: deleteField(), profile: deleteField() }, { merge: true });
    await batch.commit();
    key = await accountKeyFor(uid, []);
    set({ phase: "ready", version: snap.version + 1 });
    await applyMerge();
  });
}

export function signOut(): Promise<Result> {
  return run(async () => {
    const { auth } = getFirebase();
    const user = auth.currentUser;
    if (user && !user.isAnonymous) {
      await deleteStoredKey(user.uid); // the cards stay in the account; this device forgets the key
      markSynced(user.uid, false);
    }
    key = null;
    pendingMerge = null;
    await fbSignOut(auth);
    await establish(); // continue with a fresh private (anonymous) account
  });
}

