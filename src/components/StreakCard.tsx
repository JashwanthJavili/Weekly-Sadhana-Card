"use client";

import { useState } from "react";
import { Flame } from "@/components/icons";
import { Popover } from "@/components/pickers";
import { DAY_GOAL, type StreakInfo } from "@/lib/streak";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function message(s: StreakInfo): string {
  if (s.current === 0) return s.best > 0 ? `Best: ${s.best} days. Begin again today` : `Fill ${DAY_GOAL}+ items today to begin`;
  if (!s.doneToday) return "Fill today's card to keep it going";
  if (s.current >= s.best && s.current > 1) return "Your best streak so far. Keep going!";
  return `Best: ${s.best} day${s.best === 1 ? "" : "s"}`;
}

/** "🔥 5-day streak" with this week's days. Tap for how streaks work. */
export function StreakCard({ info }: { info: StreakInfo }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const active = info.current > 0;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={(e) => {
          const el = e.currentTarget;
          setAnchor((a) => (a ? null : el));
        }}
        className="flex w-full shrink-0 items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 text-left shadow-sm ring-1 ring-black/5 active:bg-band"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            active ? "bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-md shadow-orange-500/30" : "bg-black/[0.05] text-ink/30"
          }`}
        >
          <Flame className="h-6 w-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="block text-[15px] font-semibold whitespace-nowrap text-ink">
            <span className="text-[19px] font-bold tabular-nums">{info.current}</span> day streak
          </span>
          <span className="line-clamp-2 text-[11.5px] leading-snug text-ink/60">{message(info)}</span>
        </span>
        <span className="flex shrink-0 gap-[3px]" aria-label="This week">
          {LETTERS.map((l, i) => {
            const done = info.thisWeek[i];
            const today = i === info.todayIndex;
            return (
              <span key={i} className="flex flex-col items-center gap-0.5">
                <span className={`text-[9px] font-semibold ${today ? "text-brand" : "text-ink/40"}`}>{l}</span>
                <span
                  className={`h-[15px] w-[15px] rounded-full max-[359px]:h-3 max-[359px]:w-3 ${
                    done ? "bg-gradient-to-br from-orange-500 to-amber-400" : today ? "ring-2 ring-brand/50" : "bg-black/[0.06]"
                  }`}
                />
              </span>
            );
          })}
        </span>
      </button>
      <Popover anchor={anchor} open={!!anchor} onClose={() => setAnchor(null)} onDone={() => setAnchor(null)} title="How streaks work">
        <div className="max-w-xs space-y-3 text-[14px] text-ink/75">
          <p>
            A day counts when you fill <b className="text-ink">at least {DAY_GOAL} of the 9 items</b> on that day&apos;s card.
          </p>
          <p>Fill a card every day to grow your streak. Today isn&apos;t over yet, so your streak stays alive until midnight.</p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-center">
            <div className="rounded-xl bg-band p-2.5">
              <div className="text-[22px] font-bold text-ink tabular-nums">{info.current}</div>
              <div className="text-[11px] text-ink/55">Current streak</div>
            </div>
            <div className="rounded-xl bg-band p-2.5">
              <div className="text-[22px] font-bold text-ink tabular-nums">{info.best}</div>
              <div className="text-[11px] text-ink/55">Best streak</div>
            </div>
          </div>
        </div>
      </Popover>
    </>
  );
}
