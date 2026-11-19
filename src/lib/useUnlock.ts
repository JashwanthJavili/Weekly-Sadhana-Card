"use client";

import { useEffect, useState } from "react";
import { parseISODate } from "./dates";

/** A week's card can be downloaded / sent from 12:00 am on the Monday after the week ends. */
export function opensAt(weekStart: string): Date | null {
  const d = parseISODate(weekStart);
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7) : null;
}

const fmtDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** "3 days 4 hours", "5 hours 12 minutes", "12 minutes". */
function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (d > 0) return h > 0 ? `${unit(d, "day")} ${unit(h, "hour")}` : unit(d, "day");
  if (h > 0) return m > 0 ? `${unit(h, "hour")} ${unit(m, "minute")}` : unit(h, "hour");
  if (m > 0) return unit(m, "minute");
  return "less than a minute";
}

export interface Unlock {
  open: boolean;
  /** e.g. "Mon, 23 Nov" */
  day: string;
  /** e.g. "3 days 4 hours" (empty once open) */
  left: string;
}

/** Ticks every second until the week's card opens for download / sending. */
export function useUnlock(weekStart: string | null | undefined): Unlock {
  const at = weekStart ? opensAt(weekStart) : null;
  const atMs = at?.getTime() ?? 0;
  const [now, setNow] = useState<number | null>(null); // null until mounted (static HTML has no clock)

  useEffect(() => {
    setNow(Date.now());
    if (!atMs || Date.now() >= atMs) return;
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= atMs) window.clearInterval(t);
    }, 1000);
    return () => window.clearInterval(t);
  }, [atMs]);

  if (!at || now === null) return { open: false, day: at ? fmtDay.format(at) : "", left: "" };
  const open = now >= atMs;
  return { open, day: fmtDay.format(at), left: open ? "" : countdown(atMs - now) };
}
