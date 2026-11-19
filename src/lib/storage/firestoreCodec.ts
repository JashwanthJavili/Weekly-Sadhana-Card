import { collection, doc, getDoc, getDocs, getDocsFromCache, type DocumentData } from "firebase/firestore";
import { normalizeCard } from "../card";
import { open, seal, type Sealed } from "../crypto";
import { getFirebase } from "../firebase";
import type { Profile, WeekCard } from "../types";

/**
 * Firestore layout (everything lives under the `SadhanaCard` collection):
 *
 *   SadhanaCard/{uid}                    → { uid, updatedAt, profile?: Sealed, keyWrap?: KeyWrap }
 *   SadhanaCard/{uid}/weeks/{weekStart}  → { uid, weekStart, updatedAt, v, iv, ct }
 *
 * Only `uid`, `weekStart` and `updatedAt` are readable by the database owner.
 */
export const ROOT = "SadhanaCard";

export const userRef = (uid: string) => doc(getFirebase().db, ROOT, uid);
export const weeksRef = (uid: string) => collection(getFirebase().db, ROOT, uid, "weeks");
export const weekRef = (uid: string, weekStart: string) => doc(getFirebase().db, ROOT, uid, "weeks", weekStart);

const cardContext = (uid: string, weekStart: string) => `${ROOT}/${uid}/weeks/${weekStart}`;
const profileContext = (uid: string) => `${ROOT}/${uid}/profile`;

export async function encodeCard(uid: string, key: CryptoKey, card: WeekCard) {
  const sealed = await seal(key, card, cardContext(uid, card.weekStart));
  return { uid, weekStart: card.weekStart, updatedAt: card.updatedAt, ...sealed };
}

export const encodeProfile = (uid: string, key: CryptoKey, profile: Profile): Promise<Sealed> => seal(key, profile, profileContext(uid));

/** null when the card was encrypted with a key we don't have. */
export async function decodeCard(uid: string, key: CryptoKey, weekStart: string, data: DocumentData): Promise<WeekCard | null> {
  try {
    if (typeof data.ct === "string") {
      const card = await open<WeekCard>(key, { iv: data.iv, ct: data.ct }, cardContext(uid, weekStart));
      return normalizeCard({ ...card, weekStart });
    }
    // Very old unencrypted document: still readable; it is encrypted on its next save.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { uid: _u, ...rest } = data;
    return normalizeCard({ ...(rest as WeekCard), weekStart });
  } catch {
    return null;
  }
}

export async function decodeProfile(uid: string, key: CryptoKey, data: DocumentData | undefined): Promise<Profile | null> {
  if (!data) return null;
  try {
    const sealed = data.profile?.ct ? data.profile : typeof data.ct === "string" ? data : null; // current or older layout
    if (sealed) return await open<Profile>(key, { iv: sealed.iv, ct: sealed.ct }, profileContext(uid));
    return (data.profile as Profile | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function readAllCards(uid: string, key: CryptoKey, fromCache = false): Promise<WeekCard[]> {
  const snap = await (fromCache ? getDocsFromCache(weeksRef(uid)) : getDocs(weeksRef(uid)));
  const cards = await Promise.all(snap.docs.map((d) => decodeCard(uid, key, d.id, d.data())));
  return cards.filter((c): c is WeekCard => !!c).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

export async function readProfile(uid: string, key: CryptoKey): Promise<Profile | null> {
  return decodeProfile(uid, key, (await getDoc(userRef(uid))).data());
}
