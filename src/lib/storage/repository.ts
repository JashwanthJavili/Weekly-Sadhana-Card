import type { Profile, WeekCard } from "../types";

/**
 * Storage contract used by the UI. Everything is async so a database-backed
 * implementation (API routes / server actions) can be swapped in later
 * without touching any component.
 */
export interface CardRepository {
  listCards(): Promise<WeekCard[]>;
  /** Cards already on this device (instant, may be slightly out of date); null if unknown. */
  listCachedCards(): Promise<WeekCard[] | null>;
  getCard(weekStart: string): Promise<WeekCard | null>;
  saveCard(card: WeekCard): Promise<WeekCard>;
  deleteCard(weekStart: string): Promise<void>;
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
}
