"use client";
/* eslint-disable @next/next/no-img-element -- small static icons */

import { useRef } from "react";
import { AutoTextarea, fieldText, specsFor, YesNoToggle } from "@/components/cardFields";
import { MobileEditor } from "@/components/MobileEditor";
import { FieldPicker } from "@/components/pickers";
import { DAY_LABELS, REFLECTIONS, ROWS, type RowDef } from "@/lib/card";
import { formatShort, toISODate, weekDates } from "@/lib/dates";
import { DAY_KEYS, type DayEntry, type DayKey, type Profile, type Reflections, type WeekCard, type YesNo, type YuvaSetu } from "@/lib/types";

type Updater = (c: WeekCard) => WeekCard;

interface Props {
  card: WeekCard;
  readOnly?: boolean;
  onChange?: (updater: Updater) => void;
  onPickWeek?: (isoDate: string) => void;
  today?: string;
}

export interface CardActions {
  setDay: (day: DayKey, field: keyof DayEntry, value: string) => void;
  setProfile: (field: keyof Profile, value: string) => void;
  setReflection: (field: keyof Reflections, value: string) => void;
  setYuva: (value: YuvaSetu) => void;
}

/** The card editor: a phone layout below 1024px, the printed-card layout on desktop. */
export function SadhanaCard(props: Props) {
  const { card, readOnly = false, onChange, onPickWeek, today } = props;
  const locked = readOnly;

  const update = (fn: Updater) => {
    if (!locked) onChange?.(fn);
  };
  const actions: CardActions = {
    setDay: (day, field, value) => update((c) => ({ ...c, days: { ...c.days, [day]: { ...c.days[day], [field]: value } } })),
    setProfile: (field, value) => update((c) => ({ ...c, profile: { ...c.profile, [field]: value } })),
    setReflection: (field, value) => update((c) => ({ ...c, reflections: { ...c.reflections, [field]: value } })),
    setYuva: (value) => update((c) => ({ ...c, yuvaSetu: value })),
  };

  return (
    <>
      {/* Phones & tablets */}
      <div className="lg:hidden">
        <MobileEditor card={card} today={today} locked={locked} actions={actions} />
      </div>
      {/* Desktop: the printed card */}
      <div className="hidden lg:block">
        <PaperCard card={card} locked={locked} actions={actions} today={today} onPickWeek={onPickWeek} />
      </div>
    </>
  );
}

/* ───────────────────────── the printed-card layout ───────────────────────── */

function PaperCard(props: { card: WeekCard; locked: boolean; actions: CardActions; today?: string; onPickWeek?: (iso: string) => void }) {
  const { card, locked, actions, today, onPickWeek } = props;
  const dates = weekDates(card.weekStart);

  return (
    <div className="mx-auto w-full max-w-[860px] overflow-hidden rounded-xl bg-paper text-ink shadow-sm ring-1 ring-black/5">
      {/* Header */}
      <header className="bg-brand px-6 pt-5 pb-5 text-white">
        <h1 className="text-center font-serif text-[64px] leading-none font-bold tracking-tight">Sadhana Card</h1>
        <img src="/icons/flourish.png" alt="" className="mx-auto mt-2 h-[20px] w-[376px]" />
        <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-x-8 gap-y-2.5 font-sans text-[12.5px]">
          <HeaderField label="Name" value={card.profile.name} className="flex-1" locked={locked} onChange={(v) => actions.setProfile("name", v)} />
          <HeaderField label="Age" value={card.profile.age} inputClass="w-12" locked={locked} inputMode="numeric" maxLength={3} onChange={(v) => actions.setProfile("age", v)} />
          <HeaderField label="Mentor/Siksha Guru" value={card.profile.mentor} className="flex-1" locked={locked} onChange={(v) => actions.setProfile("mentor", v)} />
          <HeaderField label="Phone Number" value={card.profile.phone} inputClass="w-32" locked={locked} inputMode="tel" maxLength={16} onChange={(v) => actions.setProfile("phone", v)} />
        </div>
      </header>

      {/* Weekly table */}
      <section className="px-4 pt-3 pb-2">
        <div className="card-grid items-end pb-2">
          <WeekRange weekStart={card.weekStart} dates={dates} onPickWeek={onPickWeek} />
          {DAY_KEYS.map((day, i) => {
            const isToday = today === toISODate(dates[i]);
            return (
              <div key={day} className="text-center">
                <div className={`mx-auto inline-block rounded-full px-2.5 font-serif text-[16px] font-bold ${isToday ? "bg-brand text-white" : "text-brand"}`}>
                  {DAY_LABELS[day]}
                </div>
                <div className="text-[11px] text-ink/60">{formatShort(dates[i])}</div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-1">
          {ROWS.map((row, i) => {
            const shaded = i % 2 === 0;
            return (
              <div key={row.id} className={`card-grid items-center rounded-md py-1.5 ${shaded ? "bg-band" : ""}`}>
                <div className="flex items-center gap-1.5 pl-1">
                  <img src={row.icon} alt="" className="h-10 w-10 shrink-0 object-contain" />
                  <div className="flex-1 text-center font-serif text-[15px] leading-[1.15]">
                    {row.label.map((l) => (
                      <div key={l}>{l}</div>
                    ))}
                  </div>
                </div>
                {DAY_KEYS.map((day) => (
                  <div key={day} className={`cell rounded-md border border-line h-[52px] ${shaded ? "bg-cell-shaded" : "bg-white"}`}>
                    <Cell row={row} entry={card.days[day]} day={day} locked={locked} onSet={(f, v) => actions.setDay(day, f, v)} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {/* Gita For Youth (stored as yuvaSetu) */}
      <section className="mx-4 mt-2 flex items-center gap-8 border-y-2 border-dotted border-brand/70 px-2 py-2">
        <span className="font-serif text-[16px] font-bold text-brand">Gita For Youth class (Friday):</span>
        {(
          [
            ["attended", "Attended"],
            ["not_attended", "Not Attended"],
          ] as const
        ).map(([value, text]) => {
          const checked = card.yuvaSetu === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={locked}
              onClick={() => actions.setYuva(checked ? "" : value)}
              className="flex items-center gap-2 font-serif text-[16px] text-black disabled:cursor-default"
            >
              <span
                className={`flex h-[20px] w-[20px] items-center justify-center rounded-[3px] border-[1.5px] text-[14px] leading-none ${
                  checked ? "border-brand bg-brand text-white" : "border-[#bdbdbd] bg-white"
                }`}
              >
                {checked ? "✓" : ""}
              </span>
              {text}
            </button>
          );
        })}
      </section>

      {/* Reflections */}
      <section className="px-4 pt-3 pb-2">
        {REFLECTIONS.map((q) => (
          <div key={q.key} className="mb-3">
            <div className="rounded-sm bg-brand px-3 py-2.5 font-serif text-[15px] font-bold text-white">{q.question}</div>
            <div className="flex items-start gap-4 px-1 pt-2">
              <img src={q.icon} alt="" className="h-[86px] w-[100px] shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <AutoTextarea
                  value={card.reflections[q.key]}
                  disabled={locked}
                  ariaLabel={q.question}
                  onChange={(v) => actions.setReflection(q.key, v)}
                  className="lined bg-transparent"
                />
              </div>
            </div>
          </div>
        ))}
      </section>

    </div>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function HeaderField(props: {
  label: string;
  value: string;
  locked: boolean;
  onChange: (v: string) => void;
  className?: string;
  inputClass?: string;
  inputMode?: "numeric" | "tel" | "text";
  maxLength?: number;
}) {
  const { label, value, locked, onChange, className = "", inputClass = "flex-1", inputMode = "text", maxLength = 40 } = props;
  return (
    <label className={`flex min-w-0 items-end gap-2 ${className}`}>
      <span className="shrink-0 whitespace-nowrap">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={locked}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-label={label}
        className={`min-w-0 border-b border-dashed border-white/80 bg-transparent px-1 pb-0.5 text-[13px] font-medium text-white outline-none focus:border-solid focus:border-white ${inputClass}`}
      />
    </label>
  );
}

function WeekRange({ weekStart, dates, onPickWeek }: { weekStart: string; dates: Date[]; onPickWeek?: (iso: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const body = (
    <span className="font-serif text-[13px] leading-snug text-brand">
      From: <b className="underline decoration-dotted underline-offset-2">{formatShort(dates[0])}</b>
      <br />
      to <b className="underline decoration-dotted underline-offset-2">{formatShort(dates[6])}</b>{" "}
      <span className="text-[11px] text-ink/60">{dates[6].getFullYear()}</span>
    </span>
  );
  if (!onPickWeek) return <div className="pl-1">{body}</div>;
  return (
    <div className="relative pl-1">
      <button
        type="button"
        title="Pick another week"
        className="rounded-md px-1 py-0.5 text-left hover:bg-band"
        onClick={() => {
          const el = inputRef.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
      >
        {body}
      </button>
      <input
        ref={inputRef}
        type="date"
        tabIndex={-1}
        aria-label="Pick a date to open its week"
        value={weekStart}
        onChange={(e) => e.target.value && onPickWeek(e.target.value)}
        className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
      />
    </div>
  );
}

function Cell(props: { row: RowDef; entry: DayEntry; day: DayKey; locked: boolean; onSet: (field: keyof DayEntry, value: string) => void }) {
  const { row, entry, day, locked, onSet } = props;
  const v = entry[row.field];
  const label = `${DAY_LABELS[day]} – ${row.title}`;

  if (row.kind === "yesno") {
    return (
      <div className="flex h-full items-center px-1">
        <YesNoToggle size="sm" value={v as YesNo} label={label} locked={locked} onSet={(val) => onSet(row.field, val)} />
      </div>
    );
  }

  if (row.kind === "text") {
    return (
      <input
        value={v}
        onChange={(e) => onSet(row.field, e.target.value)}
        readOnly={locked}
        maxLength={30}
        aria-label={label}
        className="cell-input h-full text-[13px]"
      />
    );
  }

  const content = <CellValue row={row} entry={entry} />;

  const empty = !rowHasValue(row, entry);
  return (
    <FieldPicker
      specs={specsFor(row)}
      entry={entry}
      title={`${DAY_LABELS[day]} · ${row.title}`}
      locked={locked}
      ariaLabel={`${label}: ${empty ? "empty, tap to fill" : "tap to change"}`}
      onSet={onSet}
      className="group h-full w-full rounded-md text-ink hover:bg-brand/5 disabled:cursor-default data-[open]:bg-brand/10 data-[open]:ring-2 data-[open]:ring-brand"
    >
      {empty ? !locked && <span className="text-[20px] leading-none text-ink/15 group-hover:text-brand/70">+</span> : content}
    </FieldPicker>
  );
}

const rowHasValue = (row: RowDef, entry: DayEntry) => !!(entry[row.field] || (row.field2 && entry[row.field2]));

function CellValue({ row, entry }: { row: RowDef; entry: DayEntry }) {
  const v = entry[row.field];
  if (row.kind === "rounds") {
    const t = row.field2 ? entry[row.field2] : "";
    return (
      <div className="flex h-full flex-col items-center justify-center leading-tight">
        {v && (
          <span className="text-[15px] font-bold">
            {v} <span className="text-[10px] font-normal text-ink/60">rds</span>
          </span>
        )}
        {t && <span className="text-[11px] text-ink/75">{fieldText(row, row.field2!, t)}</span>}
      </div>
    );
  }
  return <Static className="font-semibold">{fieldText(row, row.field, v)}</Static>;
}

function Static({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex h-full items-center justify-center px-1 text-center text-[13px] leading-tight break-words ${className}`}>{children}</div>
  );
}
