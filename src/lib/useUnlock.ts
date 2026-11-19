"use client";

import { useEffect, useState } from "react";
import { parseISODate } from "./dates";

/** A week's card can be downloaded / sent from 12:00 am on the Monday after the week ends. */
export function opensAt(weekStart: string): Date | null {
  const d = parseISODate(weekStart);
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7) : null;
}

const fmtDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** "3d 4h", "5h 12m", "12m 05s". */
function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

export interface Unlock {
  open: boolean;
  /** e.g. "Mon, 23 Nov" */
  day: string;
  /** e.g. "3d 4h 12m" (empty once open) */
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
