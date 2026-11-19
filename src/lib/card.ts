import { DAY_KEYS, type DayEntry, type DayKey, type Profile, type WeekCard } from "./types";

/**
 * time     → clock time picker ("HH:MM", 24h)
 * duration → how long, stored as minutes ("90")
 * rounds   → chanting rounds + time
 * yesno    → Yes / No buttons
 * text     → free text (Seva)
 */
export type RowKind = "time" | "duration" | "text" | "yesno" | "rounds";

export interface RowDef {
  id: string;
  label: string[]; // one entry per printed line
  title: string; // used on phones and as the picker title
  icon: string;
  kind: RowKind;
  field: keyof DayEntry;
  field2?: keyof DayEntry; // second value (chanting time)
  defaultValue?: string; // where the wheel starts when the box is empty
}

/** Rows of the weekly table, in the same order as the printed card. */
export const ROWS: RowDef[] = [
  { id: "wake", label: ["Wake up", "Time"], title: "Wake up time", icon: "/icons/wake.png", kind: "time", field: "wakeUp", defaultValue: "05:00" },
  {
    id: "chanting",
    label: ["Chanting", "Rounds &", "Time"],
    title: "Chanting",
    icon: "/icons/chanting.png",
    kind: "rounds",
    field: "chantingRounds",
    field2: "chantingTime",
  },
  { id: "exercise", label: ["Exercise"], title: "Exercise", icon: "/icons/exercise.png", kind: "duration", field: "exercise", defaultValue: "30" },
  { id: "nbs", label: ["Attended", "NBS Class"], title: "Attended NBS class", icon: "/icons/nbs.png", kind: "yesno", field: "nbsClass" },
  { id: "seva", label: ["Seva"], title: "Seva", icon: "/icons/seva.png", kind: "text", field: "seva" },
  { id: "daySleep", label: ["Day", "Sleep"], title: "Day sleep", icon: "/icons/daysleep.png", kind: "duration", field: "daySleep", defaultValue: "30" },
  { id: "screen", label: ["Screen", "Time"], title: "Screen time", icon: "/icons/screen.png", kind: "duration", field: "screenTime", defaultValue: "60" },
  { id: "reading", label: ["Reading"], title: "Reading", icon: "/icons/reading.png", kind: "duration", field: "reading", defaultValue: "30" },
  { id: "sleeping", label: ["Sleeping", "Time"], title: "Sleeping time", icon: "/icons/sleeping.png", kind: "time", field: "sleepingTime", defaultValue: "22:00" },
];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "MON",
  tue: "TUE",
  wed: "WED",
  thu: "THU",
  fri: "FRI",
  sat: "SAT",
  sun: "SUN",
};

export const REFLECTIONS = [
  { key: "nicePoints", question: "1. Any nice points you heard / read this week?", icon: "/icons/bulb.png" },
  { key: "realizations", question: "2. Share some of your realizations.", icon: "/icons/notes.png" },
  { key: "concerns", question: "3. Any concerns or outstanding issues?", icon: "/icons/chat.png" },
] as const;

export const emptyProfile = (): Profile => ({ name: "", age: "", mentor: "", phone: "" });

export const blankDay = (): DayEntry => ({
  wakeUp: "",
  chantingRounds: "",
  chantingTime: "",
  exercise: "",
  nbsClass: "",
  seva: "",
  daySleep: "",
  screenTime: "",
  reading: "",
  sleepingTime: "",
});

export function blankCard(weekStart: string, profile?: Profile | null): WeekCard {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    weekStart,
    profile: { ...emptyProfile(), ...(profile ?? {}) },
    days: Object.fromEntries(DAY_KEYS.map((k) => [k, blankDay()])) as Record<DayKey, DayEntry>,
    yuvaSetu: "",
    reflections: { nicePoints: "", realizations: "", concerns: "" },
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

/** Fill in any missing fields (e.g. data saved by an older version). */
export function normalizeCard(raw: Partial<WeekCard> & { weekStart: string }): WeekCard {
  const base = blankCard(raw.weekStart);
  const days = { ...base.days };
  for (const k of DAY_KEYS) days[k] = { ...blankDay(), ...(raw.days?.[k] ?? {}) };
  return {
    ...base,
    ...raw,
    schemaVersion: 1,
    profile: { ...base.profile, ...(raw.profile ?? {}) },
    days,
    reflections: { ...base.reflections, ...(raw.reflections ?? {}) },
  };
}

/** How many of the 63 day/row boxes have something written in them. */
export function cardProgress(card: WeekCard): { filled: number; total: number } {
  let filled = 0;
  for (const k of DAY_KEYS) {
    const day = card.days[k];
    for (const row of ROWS) {
      if (day[row.field] || (row.field2 && day[row.field2])) filled++;
    }
  }
  return { filled, total: DAY_KEYS.length * ROWS.length };
}

export function isCardEmpty(card: WeekCard): boolean {
  return (
    cardProgress(card).filled === 0 &&
    !card.yuvaSetu &&
    !card.reflections.nicePoints &&
    !card.reflections.realizations &&
    !card.reflections.concerns
  );
}

/** URL of the card page for a week. */
export const cardHref = (weekStart: string) => `/card?week=${weekStart}`;

/** Your details are shared by all weeks: fill any blanks on a card from the saved details. */
export function mergeProfile(card: Profile, saved: Profile | null): Profile {
  if (!saved) return card;
  return {
    name: card.name || saved.name,
    age: card.age || saved.age,
    mentor: card.mentor || saved.mentor,
    phone: card.phone || saved.phone,
  };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * File name for a downloaded / shared card: "Name_Month_WeekN" (e.g. "Ravi Kumar_November_Week3").
 * A week belongs to the month that holds most of its days (its Thursday), and is numbered within that month.
 */
export function cardFileName(card: WeekCard): string {
  const [y, m, d] = card.weekStart.split("-").map(Number);
  const thu = new Date(y, m - 1, d + 3);
  const week = Math.ceil(thu.getDate() / 7);
  const name =
    card.profile.name
      .replace(/[\/:*?"<>|\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40) || "SadhanaCard";
  return `${name}_${MONTHS[thu.getMonth()]}_Week${week}`;
}
