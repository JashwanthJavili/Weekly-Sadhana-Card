"use client";

import { useLayoutEffect, useRef } from "react";
import type { FieldSpec } from "@/components/pickers";
import type { RowDef } from "@/lib/card";
import { formatDuration, formatTime12 } from "@/lib/dates";
import type { DayEntry, YesNo } from "@/lib/types";

/** Which wheels a row opens. */
export function specsFor(row: RowDef, which: "both" | "first" | "second" = "both"): FieldSpec[] {
  if (row.kind === "rounds") {
    const rounds: FieldSpec = { field: row.field, kind: "number", fallback: "16", label: "Rounds" };
    const time: FieldSpec = { field: row.field2!, kind: "time", fallback: "07:00", label: "Time" };
    if (which === "first") return [{ ...rounds, label: undefined }];
    if (which === "second") return [{ ...time, label: undefined }];
    return [rounds, time];
  }
  return [{ field: row.field, kind: row.kind === "time" ? "time" : "duration", fallback: row.defaultValue ?? "" }];
}

/** Human text for a single stored value. */
export function fieldText(row: RowDef, field: keyof DayEntry, value: string): string {
  if (!value) return "";
  if (row.kind === "rounds") return field === row.field ? `${value} rounds` : formatTime12(value);
  if (row.kind === "time") return formatTime12(value);
  if (row.kind === "duration") return formatDuration(value);
  return value;
}

export function rowFilled(row: RowDef, entry: DayEntry) {
  return !!(entry[row.field] || (row.field2 && entry[row.field2]));
}

/** Yes / No segmented control. Tap the selected one again to clear it. */
export function YesNoToggle(props: {
  value: YesNo;
  label: string;
  locked: boolean;
  onSet: (v: YesNo) => void;
  size?: "sm" | "md";
}) {
  const { value, label, locked, onSet, size = "md" } = props;
  const opts = [
    { val: "yes" as const, text: "Yes", on: "bg-emerald-600 text-white shadow-sm" },
    { val: "no" as const, text: "No", on: "bg-rose-500 text-white shadow-sm" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-full bg-black/[0.06] p-1 ${size === "sm" ? "w-full" : ""}`}
    >
      {opts.map((o) => {
        const active = value === o.val;
        return (
          <button
            key={o.val}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={locked}
            onClick={() => onSet(active ? "" : o.val)}
            className={`rounded-full font-semibold transition-colors disabled:cursor-default ${
              size === "sm" ? "flex-1 py-1 text-[12px]" : "px-4 py-1.5 text-sm"
            } ${active ? o.on : "text-ink/60 hover:text-ink"}`}
          >
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

export function AutoTextarea(props: {
  value: string;
  disabled: boolean;
  ariaLabel: string;
  onChange: (v: string) => void;
  className?: string;
  minHeight?: number;
  placeholder?: string;
}) {
  const { value, disabled, ariaLabel, onChange, className = "", minHeight = 68, placeholder = "Write here…" } = props;
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [value, minHeight]);
  return (
    <textarea
      ref={ref}
      value={value}
      readOnly={disabled}
      aria-label={ariaLabel}
      placeholder={disabled ? "" : placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      className={`block w-full resize-none overflow-hidden outline-none placeholder:text-ink/30 ${className}`}
    />
  );
}
