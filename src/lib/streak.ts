import { ROWS } from "./card";
import { addDays, parseISODate, toISODate, weekStartOf } from "./dates";
import { DAY_KEYS, type DayEntry, type WeekCard } from "./types";

/** A day counts towards the streak when at least this many of its 9 items are filled. */
export const DAY_GOAL = 5;

export function filledItems(entry: DayEntry): number {
  return ROWS.filter((r) => entry[r.field] || (r.field2 && entry[r.field2])).length;
}

export const isDayDone = (entry: DayEntry) => filledItems(entry) >= DAY_GOAL;

export interface StreakInfo {
  current: number;
  best: number;
  /** Mon..Sun of the current week: true when that day is done. */
  thisWeek: boolean[];
  /** Index (0–6) of today in the current week. */
  todayIndex: number;
  doneToday: boolean;
}

/** All "done" dates as YYYY-MM-DD. */
export function doneDates(cards: WeekCard[]): Set<string> {
  const out = new Set<string>();
  for (const c of cards) {
    const start = parseISODate(c.weekStart);
    if (!start) continue;
    DAY_KEYS.forEach((k, i) => {
      if (isDayDone(c.days[k])) out.add(toISODate(addDays(start, i)));
    });
  }
  return out;
}

export function computeStreak(cards: WeekCard[], today: Date = new Date()): StreakInfo {
  const done = doneDates(cards);
  const todayIso = toISODate(today);
  const doneToday = done.has(todayIso);

  // Current streak: consecutive done days ending today — or yesterday, since today isn't over yet.
  let current = 0;
  let d = doneToday ? today : addDays(today, -1);
  while (done.has(toISODate(d))) {
    current++;
    d = addDays(d, -1);
  }

  // Best streak: longest run of consecutive dates.
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const iso of [...done].sort()) {
    const date = parseISODate(iso)!;
    run = prev && toISODate(addDays(prev, 1)) === iso ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }

  const monday = weekStartOf(today);
  const thisWeek = Array.from({ length: 7 }, (_, i) => done.has(toISODate(addDays(monday, i))));
  const todayIndex = (today.getDay() + 6) % 7;

  return { current, best: Math.max(best, current), thisWeek, todayIndex, doneToday };
}
