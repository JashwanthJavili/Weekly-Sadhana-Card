// All dates are handled as *local* calendar dates ("YYYY-MM-DD") so that
// time zones never shift a day.

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** Monday of the week containing `d`. */
export function weekStartOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (r.getDay() + 6) % 7; // Mon=0 … Sun=6
  r.setDate(r.getDate() - offset);
  return r;
}

export function weekStartISO(d: Date): string {
  return toISODate(weekStartOf(d));
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function weekDates(weekStart: string): Date[] {
  const start = parseISODate(weekStart) ?? weekStartOf(new Date());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function shiftWeek(weekStart: string, weeks: number): string {
  const start = parseISODate(weekStart) ?? weekStartOf(new Date());
  return toISODate(addDays(start, weeks * 7));
}

const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const longFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const formatShort = (d: Date) => shortFmt.format(d);
export const formatLong = (d: Date) => longFmt.format(d);

/** "17 Nov – 23 Nov 2026" */
export function formatWeekRange(weekStart: string): string {
  const days = weekDates(weekStart);
  return `${formatShort(days[0])} – ${formatLong(days[6])}`;
}

/** Minutes ("90") → "1 hr 30 min" (short: "1h 30m"). Non-numeric text is returned unchanged. */
export function formatDuration(value: string, short = false): string {
  if (!/^\d+$/.test(value)) return value;
  const total = Number(value);
  if (total === 0) return "None";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (short) return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ");
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** "06:30" → "6:30 AM" (anything else is returned unchanged). */
export function formatTime12(value: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${suffix}`;
}
