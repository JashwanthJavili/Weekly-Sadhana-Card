export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export type YesNo = "" | "yes" | "no";

/** One column of the weekly table (a single day). */
export interface DayEntry {
  wakeUp: string; // "HH:MM" (24h)
  chantingRounds: string; // number of rounds
  chantingTime: string; // "HH:MM" (24h)
  exercise: string; // minutes
  nbsClass: YesNo;
  seva: string; // free text
  daySleep: string; // minutes
  screenTime: string; // minutes
  reading: string; // minutes
  sleepingTime: string; // "HH:MM" (24h)
}

export interface Profile {
  name: string;
  age: string;
  mentor: string;
  phone: string;
}

export type YuvaSetu = "" | "attended" | "not_attended";
export type CardStatus = "draft" | "completed";

export interface Reflections {
  nicePoints: string;
  realizations: string;
  concerns: string;
}

/**
 * A full weekly Sadhana Card. `weekStart` (the Monday, "YYYY-MM-DD") is the
 * unique key, so there is at most one card per week. This shape is what a
 * future database table / API will store.
 */
export interface WeekCard {
  schemaVersion: 1;
  weekStart: string;
  profile: Profile;
  days: Record<DayKey, DayEntry>;
  yuvaSetu: YuvaSetu;
  reflections: Reflections;
  status: CardStatus;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
