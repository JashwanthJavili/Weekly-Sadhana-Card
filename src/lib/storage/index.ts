import { FirestoreRepository } from "./firestoreRepository";
import { LocalStorageRepository } from "./localStorageRepository";
import type { CardRepository } from "./repository";

export type { CardRepository } from "./repository";

/**
 * The single place that decides where cards are stored.
 * Default: Firestore (`SadhanaCard` collection). Set NEXT_PUBLIC_STORAGE=local
 * at build time to keep everything in the browser instead.
 */
export const repo: CardRepository =
  process.env.NEXT_PUBLIC_STORAGE === "local" ? new LocalStorageRepository() : new FirestoreRepository();
