import { deleteDoc, deleteField, getDoc, setDoc } from "firebase/firestore";
import { requireSession } from "../account";
import type { Profile, WeekCard } from "../types";
import type { CardRepository } from "./repository";
import { decodeCard, encodeCard, encodeProfile, readAllCards, readProfile, userRef, weekRef } from "./firestoreCodec";

/** Encrypted Firestore storage. The signed-in user and their key come from lib/account. */
export class FirestoreRepository implements CardRepository {
  async listCards(): Promise<WeekCard[]> {
    const { uid, key } = await requireSession();
    return readAllCards(uid, key);
  }

  async listCachedCards(): Promise<WeekCard[] | null> {
    try {
      const { uid, key } = await requireSession();
      const cards = await readAllCards(uid, key, true);
      return cards.length ? cards : null; // an empty cache may just mean "not downloaded yet"
    } catch {
      return null;
    }
  }

  async getCard(weekStart: string): Promise<WeekCard | null> {
    const { uid, key } = await requireSession();
    const snap = await getDoc(weekRef(uid, weekStart));
    return snap.exists() ? decodeCard(uid, key, weekStart, snap.data()) : null;
  }

  async saveCard(card: WeekCard): Promise<WeekCard> {
    const { uid, key } = await requireSession();
    const saved: WeekCard = { ...card, updatedAt: new Date().toISOString() };
    await setDoc(weekRef(uid, card.weekStart), await encodeCard(uid, key, saved));
    return saved;
  }

  async deleteCard(weekStart: string): Promise<void> {
    const { uid } = await requireSession();
    await deleteDoc(weekRef(uid, weekStart));
  }

  async getProfile(): Promise<Profile | null> {
    const { uid, key } = await requireSession();
    return readProfile(uid, key);
  }

  async saveProfile(profile: Profile): Promise<void> {
    const { uid, key } = await requireSession();
    await setDoc(
      userRef(uid),
      {
        uid,
        updatedAt: new Date().toISOString(),
        profile: await encodeProfile(uid, key, profile),
        // remove the older top-level layout if present
        v: deleteField(),
        iv: deleteField(),
        ct: deleteField(),
      },
      { merge: true },
    );
  }
}
