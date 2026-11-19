import { normalizeCard } from "../card";
import type { Profile, WeekCard } from "../types";
import type { CardRepository } from "./repository";

const CARDS_KEY = "sadhana-card:v1:cards";
const PROFILE_KEY = "sadhana-card:v1:profile";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    throw new Error(
      "Could not save to this browser's storage (it may be full or disabled). " +
        (e instanceof Error ? e.message : ""),
    );
  }
}

type CardMap = Record<string, WeekCard>;

const readCards = (): CardMap => readJSON<CardMap>(CARDS_KEY, {});

export class LocalStorageRepository implements CardRepository {
  async listCards(): Promise<WeekCard[]> {
    return Object.values(readCards())
      .map((c) => normalizeCard(c))
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  async listCachedCards(): Promise<WeekCard[] | null> {
    return this.listCards();
  }

  async getCard(weekStart: string): Promise<WeekCard | null> {
    const c = readCards()[weekStart];
    return c ? normalizeCard(c) : null;
  }

  async saveCard(card: WeekCard): Promise<WeekCard> {
    const cards = readCards();
    const saved: WeekCard = {
      ...card,
      createdAt: cards[card.weekStart]?.createdAt ?? card.createdAt,
      updatedAt: new Date().toISOString(),
    };
    cards[card.weekStart] = saved;
    writeJSON(CARDS_KEY, cards);
    return saved;
  }

  async deleteCard(weekStart: string): Promise<void> {
    const cards = readCards();
    delete cards[weekStart];
    writeJSON(CARDS_KEY, cards);
  }

  async getProfile(): Promise<Profile | null> {
    return readJSON<Profile | null>(PROFILE_KEY, null);
  }

  async saveProfile(profile: Profile): Promise<void> {
    writeJSON(PROFILE_KEY, profile);
  }
}
