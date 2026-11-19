/**
 * Who is signed in, and the encryption key for their cards.
 *
 * - Everyone starts with a private anonymous account and a key that lives only on this device.
 * - "Sign in with Google" (optional) links that account to Google, so the cards follow the person.
 *   To keep cards end-to-end encrypted across devices, the person creates a passphrase: the data
 *   key is stored in Firestore only *wrapped* with that passphrase.
 * - On a new device: sign in → enter passphrase → cards unlock.
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
import { deleteField, getDoc, getDocFromCache, getDocs, writeBatch } from "firebase/firestore";
import { createDeviceKey, deleteStoredKey, generateDataKey, loadStoredKey, storeKey, unwrapKey, wrapKey, type KeyWrap } from "./crypto";
import { authErrorMessage, getFirebase } from "./firebase";
import { encodeCard, encodeProfile, readAllCards, readProfile, userRef, weekRef, weeksRef } from "./storage/firestoreCodec";
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
    super("Your cards are locked. Enter your passphrase to open them.");
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

/** Make sure someone is signed in, then work out their key situation. */
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

  if (stored) {
    // Fast path: this device already holds the key, so the cards can load right away.
    // Whether a passphrase exists only matters for the account sheet: read it from the
    // local cache now and confirm with the server in the background.
    key = stored;
    const uid = user.uid;
    const cached = await getDocFromCache(userRef(uid)).then(
      (d) => !!d.data()?.keyWrap,
      () => false,
    );
    set({ phase: cached ? "ready" : "needs-setup", user: toUser(user), error: null, version: snap.version + 1 });
    fetchKeyWrap(uid)
      .then((w) => {
        const phase = w ? "ready" : "needs-setup";
        if (snap.user?.uid === uid && key === stored && snap.phase !== phase && (snap.phase === "ready" || snap.phase === "needs-setup")) set({ phase });
      })
      .catch(() => undefined);
    return;
  }

  const wrap = await fetchKeyWrap(user.uid);
  if (wrap) {
    key = null;
    set({ phase: "locked", user: toUser(user), error: null, version: snap.version + 1 });
  } else {
    key = await createDeviceKey(user.uid);
    set({ phase: "needs-setup", user: toUser(user), error: null, version: snap.version + 1 });
  }
}

/** Run an account operation exclusively; data access waits for it. */
function run(op: () => Promise<void>): Promise<Result> {
  const p = current.catch(() => undefined).then(op);
  current = p;
  return p.then(
    () => ({ ok: true as const }),
    (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Something went wrong." }),
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

/** Encrypt everything with a fresh key and store that key locked with the passphrase. */
async function rekeyWithPassphrase(passphrase: string) {
  if (!snap.user || snap.user.isAnonymous) throw new Error("Please sign in first.");
  const { uid } = snap.user;
  const old = key;
  const cards = old ? await readAllCards(uid, old) : [];
  const profile = old ? await readProfile(uid, old) : null;

  const { raw, key: fresh } = await generateDataKey();
  const keyWrap = await wrapKey(raw, passphrase);
  raw.fill(0);

  const batch = writeBatch(getFirebase().db);
  for (const c of cards) batch.set(weekRef(uid, c.weekStart), await encodeCard(uid, fresh, c));
  batch.set(
    userRef(uid),
    {
      uid,
      updatedAt: new Date().toISOString(),
      keyWrap,
      profile: profile ? await encodeProfile(uid, fresh, profile) : deleteField(),
      v: deleteField(),
      iv: deleteField(),
      ct: deleteField(),
    },
    { merge: true },
  );
  await batch.commit();

  await storeKey(uid, fresh);
  key = fresh;
  set({ phase: "ready", version: snap.version + 1 });
  await applyMerge();
}

/* ───────── public API ───────── */

export function initAccount() {
  if (started) return current;
  started = true;
  current = establish().catch((e: unknown) => {
    started = false;
    set({ phase: "error", error: e instanceof Error ? e.message : "Could not connect." });
  });
  return current;
}

/** Used by the storage layer before every read/write. */
export async function requireSession(): Promise<{ uid: string; key: CryptoKey }> {
  await initAccount();
  await current.catch(() => undefined);
  if (snap.phase === "locked") throw new LockedError();
  if (!key || !snap.user) throw new Error(snap.error ?? "Could not connect. Please try again.");
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

export function setupPassphrase(passphrase: string): Promise<Result> {
  return run(() => rekeyWithPassphrase(passphrase));
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
      throw new Error("That passphrase is not right. Please try again.");
    }
    await storeKey(snap.user.uid, k);
    key = k;
    set({ phase: "ready", version: snap.version + 1 });
    await applyMerge();
  });
}

/** Forgot the passphrase: delete the (unreadable) cards and start again with a new passphrase. */
export function resetWithNewPassphrase(passphrase: string): Promise<Result> {
  return run(async () => {
    if (!snap.user || snap.user.isAnonymous) throw new Error("Please sign in first.");
    const { uid } = snap.user;
    const batch = writeBatch(getFirebase().db);
    (await getDocs(weeksRef(uid))).forEach((d) => batch.delete(d.ref));
    batch.set(userRef(uid), { uid, updatedAt: new Date().toISOString(), keyWrap: deleteField(), profile: deleteField() }, { merge: true });
    await batch.commit();
    key = null;
    await rekeyWithPassphrase(passphrase);
  });
}

export function signOut(): Promise<Result> {
  return run(async () => {
    const { auth } = getFirebase();
    const user = auth.currentUser;
    if (user && !user.isAnonymous) await deleteStoredKey(user.uid); // nobody else can open the cards on this device
    key = null;
    pendingMerge = null;
    await fbSignOut(auth);
    await establish(); // continue with a fresh private (anonymous) account
  });
}

/** Ask the UI to show the passphrase setup again ("Finish setup"). */
export function requestSetup() {
  set({ setupRequest: snap.setupRequest + 1 });
}
