/**
 * End-to-end encryption for Sadhana Card data.
 *
 * - Card data is encrypted with a random AES-256-GCM "data key" inside the browser.
 * - The data key is kept in this browser's IndexedDB as a *non-extractable* CryptoKey:
 *   page code can use it, but it can never be read out.
 * - Signed-in (Google) users additionally store a copy of the data key *wrapped* with a key
 *   derived from their passphrase (PBKDF2-SHA256, 600k iterations). The passphrase never
 *   leaves the device, so the server only ever holds ciphertext.
 * - Each ciphertext is bound to its document path as associated data, so encrypted documents
 *   cannot be swapped around.
 */

const DB_NAME = "sadhana-card-keys";
const STORE = "keys";
const PBKDF2_ITERATIONS = 600_000;
const WRAP_AAD = "sadhana-card:key-wrap:v1";

export interface Sealed {
  v: 1;
  iv: string; // base64
  ct: string; // base64 ciphertext (+ GCM tag)
}

export interface KeyWrap {
  v: 1;
  salt: string; // base64
  iter: number;
  iv: string; // base64
  ct: string; // base64 (wrapped 32-byte data key + tag)
}

/* ───────── IndexedDB ───────── */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

const keyId = (uid: string) => `aes-gcm:${uid}`;

export const loadStoredKey = (uid: string) => idb<CryptoKey>("readonly", (s) => s.get(keyId(uid)));
export const storeKey = (uid: string, key: CryptoKey) => idb<void>("readwrite", (s) => s.put(key, keyId(uid))).then(() => undefined);
export const deleteStoredKey = (uid: string) => idb<void>("readwrite", (s) => s.delete(keyId(uid))).then(() => undefined);

/* ───────── keys ───────── */

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));
}

const importDataKey = (raw: Uint8Array<ArrayBuffer>) =>
  crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);

/** A key that exists only on this device (used before a passphrase is set up). */
export async function createDeviceKey(uid: string): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await storeKey(uid, key);
  return key;
}

/** A new data key. `raw` is returned once so it can be wrapped, then should be discarded. */
export async function generateDataKey(): Promise<{ raw: Uint8Array<ArrayBuffer>; key: CryptoKey }> {
  const raw = bytes(32);
  return { raw, key: await importDataKey(raw) };
}

async function deriveKek(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function wrapKey(raw: Uint8Array<ArrayBuffer>, passphrase: string): Promise<KeyWrap> {
  const salt = bytes(16);
  const iv = bytes(12);
  const kek = await deriveKek(passphrase, salt, PBKDF2_ITERATIONS);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(WRAP_AAD) }, kek, raw);
  return { v: 1, salt: toB64(salt), iter: PBKDF2_ITERATIONS, iv: toB64(iv), ct: toB64(ct) };
}

/** Throws if the passphrase is wrong. */
export async function unwrapKey(wrap: KeyWrap, passphrase: string): Promise<CryptoKey> {
  const kek = await deriveKek(passphrase, fromB64(wrap.salt), wrap.iter);
  const raw = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(wrap.iv), additionalData: enc.encode(WRAP_AAD) }, kek, fromB64(wrap.ct)),
  );
  const key = await importDataKey(raw);
  raw.fill(0);
  return key;
}

/* ───────── sealing data ───────── */

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function seal(key: CryptoKey, value: unknown, context: string): Promise<Sealed> {
  const iv = bytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(context) }, key, enc.encode(JSON.stringify(value)));
  return { v: 1, iv: toB64(iv), ct: toB64(ct) };
}

export async function open<T>(key: CryptoKey, sealed: Pick<Sealed, "iv" | "ct">, context: string): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(sealed.iv), additionalData: enc.encode(context) },
    key,
    fromB64(sealed.ct),
  );
  return JSON.parse(dec.decode(plain)) as T;
}
