"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/icons";
import { useKeyboardInset } from "@/lib/useKeyboard";
import type { DayEntry } from "@/lib/types";

/* ════════════════════════ Popover (desktop) / bottom sheet (phone) ════════════════════════ */

const SHEET_BELOW = 1024; // same breakpoint as the phone layout (lg)

export function Popover(props: {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  onDone?: () => void;
  onClear?: () => void;
}) {
  const { anchor, open, onClose, title, children, onDone, onClear } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [sheet, setSheet] = useState(() => typeof window !== "undefined" && window.innerWidth < SHEET_BELOW);

  // Keep the sheet on screen for a moment after closing so it can slide away softly.
  const [leaving, setLeaving] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setLeaving(!open && sheet);
  }
  useEffect(() => {
    if (!leaving) return;
    // Drop the keyboard right away instead of after the animation.
    const a = document.activeElement;
    if (a instanceof HTMLElement && panelRef.current?.contains(a)) a.blur();
    const t = window.setTimeout(() => setLeaving(false), 200);
    return () => window.clearTimeout(t);
  }, [leaving]);

  const keyboard = useKeyboardInset(open && sheet);

  const place = useCallback(() => {
    if (!anchor || !panelRef.current) return;
    const isSheet = window.innerWidth < SHEET_BELOW;
    setSheet(isSheet);
    if (isSheet) return setPos({ left: 0, top: 0 });
    const r = anchor.getBoundingClientRect();
    const h = panelRef.current.offsetHeight;
    const PANEL_W = panelRef.current.offsetWidth;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Math.min(Math.max(8, r.left + r.width / 2 - PANEL_W / 2), vw - PANEL_W - 8);
    let top = r.bottom + 6;
    if (top + h > vh - 8) {
      const above = r.top - h - 6;
      if (above >= 8) top = above;
      else {
        top = Math.min(Math.max(8, r.top + r.height / 2 - h / 2), Math.max(8, vh - h - 8));
        left = r.right + 8 + PANEL_W <= vw - 8 ? r.right + 8 : Math.max(8, r.left - PANEL_W - 8);
      }
    }
    setPos({ left, top });
  }, [anchor]);

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    // Desktop popover: a press anywhere outside closes it.
    // Phone sheet: only the backdrop closes it (on click), so the tap never reaches the page underneath.
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        anchor?.focus({ preventScroll: true });
      }
    };
    const onResize = () => place();
    const onScroll = (e: Event) => {
      // Scrolling inside the wheels must not move the panel.
      if (panelRef.current?.contains(e.target as Node)) return;
      place();
    };
    if (!sheet) {
      window.addEventListener("pointerdown", onDown, true);
      window.addEventListener("scroll", onScroll, true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open, onClose, anchor, place, sheet]);

  // Lock page scroll behind the phone sheet.
  useEffect(() => {
    if (!open || !sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, sheet]);

  if ((!open && !leaving) || typeof document === "undefined") return null;
  const closing = !open;

  return createPortal(
    <>
      {sheet && (
        <div
          className={`fixed inset-0 z-40 touch-none bg-black/75 ${closing ? "sheet-backdrop-out" : "sheet-backdrop"}`}
          aria-hidden
          onClick={closing ? undefined : onClose}
        />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={sheet}
        aria-label={typeof title === "string" ? title : undefined}
        style={
          sheet
            ? { bottom: keyboard, transition: "bottom 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)" }
            : { left: pos?.left ?? -9999, top: pos?.top ?? -9999, minWidth: 280 }
        }
        className={
          sheet
            ? `fixed inset-x-0 z-50 rounded-t-3xl bg-white shadow-2xl ${closing ? "sheet-panel-out pointer-events-none" : "sheet-panel"}`
            : "fixed z-50 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10"
        }
      >
        {sheet && <CloseFab onClick={onClose} />}
        <div
          className={sheet ? "overflow-y-auto overscroll-contain px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]" : undefined}
          style={sheet ? { maxHeight: `calc(100dvh - ${keyboard}px - 88px)` } : undefined}
        >
          {sheet && <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-black/15" aria-hidden />}
          <div className="mb-3 flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate font-semibold text-ink">{title}</div>
            {onClear && (
              <button type="button" onClick={onClear} className="rounded-full px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50">
                Clear
              </button>
            )}
            {onDone && (
              <button type="button" onClick={onDone} className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
                Done
              </button>
            )}
          </div>
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Round close button that floats just above a bottom sheet. */
export function CloseFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="absolute -top-14 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-white text-ink shadow-lg transition-transform active:scale-95"
    >
      <XIcon className="h-5 w-5" />
    </button>
  );
}

/* ════════════════════════ Scroll wheel ════════════════════════ */

const ITEM_H = 44;
const WHEEL_H = ITEM_H * 5;

interface Option {
  value: string;
  label: string;
}

export function Wheel(props: { options: Option[]; value: string; onChange: (v: string) => void; label: string; width?: number }) {
  const { options, value, onChange, label, width = 68 } = props;
  const ref = useRef<HTMLDivElement>(null);
  const startIdx = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(startIdx);
  const lastEmitted = useRef(value);
  const settle = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = startIdx * ITEM_H;
    // Only on mount: afterwards the wheel itself is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (i: number) => ref.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" });

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
    setActive(i);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const v = options[i].value;
      if (v !== lastEmitted.current) {
        lastEmitted.current = v;
        onChange(v);
      }
    }, 90);
  };

  return (
    <div className="relative" style={{ width }}>
      <div
        ref={ref}
        onScroll={onScroll}
        tabIndex={0}
        role="listbox"
        aria-label={label}
        aria-activedescendant={undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            goTo(Math.min(options.length - 1, active + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            goTo(Math.max(0, active - 1));
          }
        }}
        className="wheel relative snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none"
        style={{ height: WHEEL_H, paddingBlock: (WHEEL_H - ITEM_H) / 2 }}
      >
        {options.map((o, i) => (
          <div
            key={o.value}
            role="option"
            aria-selected={i === active}
            onClick={() => goTo(i)}
            className={`flex cursor-pointer snap-center items-center justify-center tabular-nums transition-[color,font-size] duration-100 ${
              i === active ? "text-[22px] font-semibold text-ink" : Math.abs(i - active) === 1 ? "text-[18px] text-ink/45" : "text-[16px] text-ink/25"
            }`}
            style={{ height: ITEM_H }}
          >
            {o.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════ Wheel groups ════════════════════════ */

/** Lays wheels side by side with one shared highlight band across the selected row. */
function WheelGroup({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex items-center gap-1 px-1" style={{ height: WHEEL_H }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 rounded-xl bg-band ring-1 ring-brand/15"
        style={{ top: (WHEEL_H - ITEM_H) / 2, height: ITEM_H }}
      />
      {children}
    </div>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

const HOUR_OPTS = range(1, 12).map((h) => ({ value: String(h), label: String(h) }));
const MIN_OPTS = range(0, 55, 5).map((m) => ({ value: String(m), label: pad2(m) }));
const AMPM_OPTS = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

function parseTime(v: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(v) ?? ["", "05", "00"];
  const h = Number(m[1]);
  const min = Math.min(55, Math.round(Number(m[2]) / 5) * 5);
  return { h12: h % 12 === 0 ? 12 : h % 12, min, period: h >= 12 ? "PM" : "AM" };
}
function toTime(h12: number, min: number, period: string) {
  return `${pad2((h12 % 12) + (period === "PM" ? 12 : 0))}:${pad2(min)}`;
}

function TimeWheels({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = parseTime(value);
  // Latest composed value, updated immediately so two wheels settling together don't overwrite each other.
  const cur = useRef(t);
  const lastValue = useRef(value);
  if (value !== lastValue.current) {
    lastValue.current = value;
    cur.current = t;
  }
  const set = (patch: Partial<typeof t>) => {
    const n = { ...cur.current, ...patch };
    cur.current = n;
    const v = toTime(n.h12, n.min, n.period);
    lastValue.current = v;
    onChange(v);
  };
  return (
    <WheelGroup>
      <Wheel label="Hour" options={HOUR_OPTS} value={String(t.h12)} onChange={(v) => set({ h12: Number(v) })} />
      <span className="relative pb-0.5 text-xl font-semibold text-ink/50">:</span>
      <Wheel label="Minute" options={MIN_OPTS} value={String(t.min)} onChange={(v) => set({ min: Number(v) })} />
      <Wheel label="AM or PM" options={AMPM_OPTS} value={t.period} onChange={(v) => set({ period: v })} />
    </WheelGroup>
  );
}

const DUR_H_OPTS = range(0, 12).map((h) => ({ value: String(h), label: String(h) }));

function DurationWheels({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const total = /^\d+$/.test(value) ? Number(value) : 30;
  const h = Math.min(12, Math.floor(total / 60));
  const m = Math.min(55, Math.round((total % 60) / 5) * 5);
  const cur = useRef({ h, m });
  const lastValue = useRef(value);
  if (value !== lastValue.current) {
    lastValue.current = value;
    cur.current = { h, m };
  }
  const set = (patch: Partial<{ h: number; m: number }>) => {
    cur.current = { ...cur.current, ...patch };
    const v = String(cur.current.h * 60 + cur.current.m);
    lastValue.current = v;
    onChange(v);
  };
  return (
    <WheelGroup>
      <Wheel label="Hours" options={DUR_H_OPTS} value={String(h)} onChange={(v) => set({ h: Number(v) })} />
      <span className="relative text-sm font-medium text-ink/50">hr</span>
      <Wheel label="Minutes" options={MIN_OPTS} value={String(m)} onChange={(v) => set({ m: Number(v) })} />
      <span className="relative pr-2 text-sm font-medium text-ink/50">min</span>
    </WheelGroup>
  );
}

const ROUND_OPTS = range(0, 64).map((r) => ({ value: String(r), label: String(r) }));

function NumberWheel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const v = /^\d+$/.test(value) ? String(Math.min(64, Number(value))) : "16";
  return (
    <WheelGroup>
      <Wheel label="Rounds" options={ROUND_OPTS} value={v} onChange={onChange} />
      <span className="relative pr-2 text-sm font-medium text-ink/50">rounds</span>
    </WheelGroup>
  );
}

/* ════════════════════════ Field picker (trigger + sheet) ════════════════════════ */

export type FieldKind = "time" | "duration" | "number";
export interface FieldSpec {
  field: keyof DayEntry;
  kind: FieldKind;
  fallback: string; // value shown when the box is still empty
  label?: string; // sub-heading when several wheels groups are shown
}

/**
 * A button that opens wheel pickers for one or more fields.
 * Changes apply when the sheet is closed (Done, tap outside, Esc) — Clear empties the box.
 */
export function FieldPicker(props: {
  specs: FieldSpec[];
  entry: DayEntry;
  title: string;
  locked: boolean;
  ariaLabel: string;
  onSet: (field: keyof DayEntry, value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const { specs, entry, title, locked, ariaLabel, onSet, className = "", children } = props;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const touched = useRef(false);
  const hasValue = specs.some((s) => entry[s.field]);

  const openAt = (el: HTMLElement) => {
    setDraft(Object.fromEntries(specs.map((s) => [s.field, entry[s.field] || s.fallback])));
    touched.current = false;
    setAnchor(el);
  };

  const close = (save: boolean) => {
    if (save) for (const s of specs) if (draft[s.field] !== entry[s.field]) onSet(s.field, draft[s.field]);
    setAnchor(null);
  };

  return (
    <>
      <button
        type="button"
        disabled={locked}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        aria-label={ariaLabel}
        onClick={(e) => (anchor ? close(touched.current) : openAt(e.currentTarget))}
        className={className}
        data-open={anchor ? "" : undefined}
      >
        {children}
      </button>
      <Popover
        anchor={anchor}
        open={!!anchor}
        title={title}
        onClose={() => close(touched.current)}
        onDone={() => close(true)}
        onClear={
          hasValue
            ? () => {
                for (const s of specs) onSet(s.field, "");
                setAnchor(null);
              }
            : undefined
        }
      >
        <div className="flex items-start justify-center gap-5 py-1">
          {specs.map((s) => {
            const change = (v: string) => {
              touched.current = true;
              setDraft((d) => ({ ...d, [s.field]: v }));
            };
            const value = draft[s.field] ?? s.fallback;
            return (
              <div key={s.field} className="flex flex-col items-center">
                {s.label && <div className="mb-1 text-[11px] font-semibold tracking-wide text-ink/50 uppercase">{s.label}</div>}
                {s.kind === "time" && <TimeWheels value={value} onChange={change} />}
                {s.kind === "duration" && <DurationWheels value={value} onChange={change} />}
                {s.kind === "number" && <NumberWheel value={value} onChange={change} />}
              </div>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
