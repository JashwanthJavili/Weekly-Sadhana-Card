"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AutoTextarea, fieldText, rowFilled, specsFor, YesNoToggle } from "@/components/cardFields";
import { ChevronDown, ChevronRight } from "@/components/icons";
import { FieldPicker, Popover } from "@/components/pickers";
import type { CardActions } from "@/components/SadhanaCard";
import { DAY_LABELS, REFLECTIONS, ROWS, type RowDef } from "@/lib/card";
import { formatShort, toISODate, weekDates } from "@/lib/dates";
import { DAY_KEYS, type DayEntry, type DayKey, type Profile, type WeekCard, type YesNo } from "@/lib/types";

const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long" });

export function MobileEditor(props: { card: WeekCard; today?: string; locked: boolean; actions: CardActions }) {
  const { card, today, locked, actions } = props;
  const dates = weekDates(card.weekStart);
  const todayIdx = dates.findIndex((d) => toISODate(d) === today);
  const [sel, setSel] = useState(todayIdx >= 0 ? todayIdx : 0);
  // Open on today's column as soon as "today" is known.
  useEffect(() => {
    if (todayIdx >= 0) setSel(todayIdx);
  }, [todayIdx]);
  const day = DAY_KEYS[sel];
  const entry = card.days[day];
  const filledToday = ROWS.filter((r) => rowFilled(r, entry)).length;

  return (
    <div className="space-y-3 pb-6">
      {/* Slim header */}
      <div className="rounded-2xl bg-brand px-4 py-3 text-center text-white shadow-sm">
        <div className="font-serif text-[24px] leading-none font-bold whitespace-nowrap">Sadhana Card</div>
        <img src="/icons/flourish.png" alt="" className="mx-auto mt-1.5 h-[8px] w-[140px] opacity-90" />
      </div>

      {/* Your details */}
      <ProfileFields profile={card.profile} locked={locked} setProfile={actions.setProfile} />

      {/* Day strip (stays visible while scrolling) */}
      <div className="sticky top-14 z-10 -mx-3 bg-desk/95 px-3 py-2">
        <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Day of the week">
          {DAY_KEYS.map((k, i) => {
            const active = sel === i;
            const done = ROWS.some((r) => rowFilled(r, card.days[k]));
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSel(i)}
                className={`relative flex flex-col items-center rounded-2xl py-2 transition-colors ${
                  active ? "bg-brand text-white shadow-md" : "bg-white text-ink shadow-sm"
                }`}
              >
                <span className={`text-[10px] font-semibold tracking-wide ${active ? "text-white/80" : "text-ink/50"}`}>{DAY_LABELS[k]}</span>
                <span className="text-[17px] leading-tight font-semibold">{dates[i].getDate()}</span>
                <span
                  aria-hidden
                  className={`mt-0.5 h-1 w-1 rounded-full ${done ? (active ? "bg-white" : "bg-brand") : "bg-transparent"} ${
                    i === todayIdx && !active ? "ring-2 ring-brand/30" : ""
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day */}
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-serif text-xl font-bold text-ink">
          {weekdayFmt.format(dates[sel])}
          <span className="ml-1.5 font-sans text-sm font-normal text-ink/50">{formatShort(dates[sel])}</span>
          {sel === todayIdx && <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 align-middle font-sans text-[11px] font-semibold text-brand">Today</span>}
        </h2>
        <span className="text-xs text-ink/50">
          {filledToday}/{ROWS.length} done
        </span>
      </div>

      <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl bg-white shadow-sm">
        {ROWS.map((row) => (
          <Row key={row.id} row={row} entry={entry} day={day} locked={locked} onSet={(f, v) => actions.setDay(day, f, v)} />
        ))}
      </div>

      {/* Weekly */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 font-serif text-[17px] font-bold text-ink">YUVA Setu class (Friday)</div>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["attended", "Attended"],
              ["not_attended", "Not attended"],
            ] as const
          ).map(([value, text]) => {
            const on = card.yuvaSetu === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={locked}
                onClick={() => actions.setYuva(on ? "" : value)}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                  on ? "border-brand bg-brand text-white" : "border-line bg-white text-ink/70"
                }`}
              >
                {text}
              </button>
            );
          })}
        </div>
      </div>

      {REFLECTIONS.map((q) => (
        <div key={q.key} className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <img src={q.icon} alt="" className="h-10 w-10 shrink-0 object-contain" />
            <div className="font-serif text-[16px] leading-snug font-bold text-ink">{q.question.replace(/^\d\.\s*/, "")}</div>
          </div>
          <AutoTextarea
            value={card.reflections[q.key]}
            disabled={locked}
            ariaLabel={q.question}
            minHeight={88}
            placeholder="Write your thoughts…"
            onChange={(v) => actions.setReflection(q.key, v)}
            className="rounded-xl border border-line bg-paper px-3 py-2.5 text-[16px] leading-relaxed focus:border-brand"
          />
        </div>
      ))}
    </div>
  );
}

/* ───────── one line in the day list ───────── */

function Row(props: { row: RowDef; entry: DayEntry; day: DayKey; locked: boolean; onSet: (f: keyof DayEntry, v: string) => void }) {
  const { row, entry, day, locked, onSet } = props;
  const title = `${DAY_LABELS[day]} · ${row.title}`;
  const icon = <img src={row.icon} alt="" className="h-8 w-8 shrink-0 object-contain" />;
  const name = <span className="min-w-0 flex-1 text-[15px] font-medium text-ink">{row.title}</span>;

  if (row.kind === "yesno") {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        {icon}
        {name}
        <YesNoToggle value={entry.nbsClass as YesNo} label={title} locked={locked} onSet={(v) => onSet(row.field, v)} />
      </div>
    );
  }

  if (row.kind === "text") {
    return <SevaRow icon={icon} title={title} label={row.title} value={entry[row.field]} locked={locked} onSave={(v) => onSet(row.field, v)} />;
  }

  if (row.kind === "rounds") {
    const chip = (which: "first" | "second", field: keyof DayEntry, placeholder: string) => {
      const v = entry[field];
      return (
        <FieldPicker
          specs={specsFor(row, which)}
          entry={entry}
          title={`${title} ${which === "first" ? "rounds" : "time"}`}
          locked={locked}
          ariaLabel={`${title} ${which === "first" ? "rounds" : "time"}: ${v ? fieldText(row, field, v) : "not set"}`}
          onSet={onSet}
          className={`rounded-full px-3 py-1.5 text-[14px] font-semibold transition-colors ${
            v ? "bg-brand/10 text-brand" : "bg-black/[0.05] font-normal text-ink/40"
          } data-[open]:ring-2 data-[open]:ring-brand`}
        >
          {v ? fieldText(row, field, v) : placeholder}
        </FieldPicker>
      );
    };
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        {icon}
        {name}
        <div className="flex gap-1.5">
          {chip("first", row.field, "Rounds")}
          {chip("second", row.field2!, "Time")}
        </div>
      </div>
    );
  }

  const v = entry[row.field];
  return (
    <FieldPicker
      specs={specsFor(row)}
      entry={entry}
      title={title}
      locked={locked}
      ariaLabel={`${title}: ${v ? fieldText(row, row.field, v) : "not set"}`}
      onSet={onSet}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-band data-[open]:bg-band"
    >
      {icon}
      {name}
      {v ? (
        <span className="text-[15px] font-semibold text-brand">{fieldText(row, row.field, v)}</span>
      ) : (
        <span className="text-[15px] text-ink/30">Add</span>
      )}
      {!locked && <ChevronRight className="h-4 w-4 text-ink/25" />}
    </FieldPicker>
  );
}

/* ───────── your details: compact form rows ───────── */

function ProfileFields(props: { profile: Profile; locked: boolean; setProfile: (f: keyof Profile, v: string) => void }) {
  const { profile, locked, setProfile } = props;
  const row = (key: keyof Profile, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, className = "") => (
    <label className={`flex min-w-0 items-center gap-2 px-3 py-2 ${className}`}>
      <span className="w-[52px] shrink-0 text-[12px] text-ink/45">{label}</span>
      <input
        value={profile[key]}
        onChange={(e) => setProfile(key, e.target.value)}
        readOnly={locked}
        placeholder="—"
        className="min-w-0 flex-1 bg-transparent text-[16px] font-medium text-ink outline-none placeholder:text-ink/20"
        {...extra}
      />
    </label>
  );
  return (
    <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl bg-white shadow-sm">
      {row("name", "Name", { maxLength: 40, autoComplete: "name" })}
      {row("mentor", "Mentor", { maxLength: 40, "aria-label": "Mentor / Siksha Guru" })}
      <div className="flex divide-x divide-black/[0.06]">
        {row("age", "Age", { inputMode: "numeric", maxLength: 3 }, "w-[38%]")}
        {row("phone", "Phone", { inputMode: "tel", maxLength: 16, autoComplete: "tel" }, "flex-1")}
      </div>
    </div>
  );
}

/* ───────── seva: row + sheet with a text box (suggestions on request) ───────── */

const SEVA_SUGGESTIONS = ["Cleaning", "Cooking", "Prasadam serving", "Kirtan", "Book distribution", "Deity service", "Decoration"];

function SevaRow(props: { icon: React.ReactNode; title: string; label: string; value: string; locked: boolean; onSave: (v: string) => void }) {
  const { icon, title, label, value, locked, onSave } = props;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState("");
  const [showIdeas, setShowIdeas] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus the box in the same tap that opened the sheet (so the keyboard comes up),
  // without letting the browser jump the page around.
  useLayoutEffect(() => {
    if (anchor) inputRef.current?.focus({ preventScroll: true });
  }, [anchor]);

  const close = (save: boolean) => {
    if (save && draft.trim() !== value) onSave(draft.trim());
    setAnchor(null);
  };

  // Tap a suggestion to add it (tap again to remove it).
  const parts = draft
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const toggle = (s: string) => {
    const next = parts.includes(s) ? parts.filter((p) => p !== s) : [...parts, s];
    const text = next.join(", ");
    if (text.length <= 40) setDraft(text); // never cut a suggestion in half
  };

  return (
    <>
      <button
        type="button"
        disabled={locked}
        aria-haspopup="dialog"
        aria-label={`${title}: ${value || "not set"}`}
        onClick={(e) => {
          setDraft(value);
          setShowIdeas(false);
          setAnchor(e.currentTarget);
        }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-band disabled:cursor-default"
      >
        {icon}
        <span className="shrink-0 text-[15px] font-medium text-ink">{label}</span>
        <span className={`min-w-0 flex-1 truncate text-right text-[14px] ${value ? "font-semibold text-brand" : "text-ink/30"}`}>{value || "Add"}</span>
        {!locked && <ChevronRight className="h-4 w-4 text-ink/25" />}
      </button>
      <Popover
        anchor={anchor}
        open={!!anchor}
        title={title}
        onClose={() => close(true)}
        onDone={() => close(true)}
        onClear={
          value || draft
            ? () => {
                setDraft("");
                if (value) onSave("");
                setAnchor(null);
              }
            : undefined
        }
      >
        <input
          ref={inputRef}
          value={draft}
          enterKeyHint="done"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && close(true)}
          maxLength={40}
          placeholder="What seva did you do today?"
          className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink/35 focus:border-brand"
        />
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()} // keep the keyboard open
          onClick={() => setShowIdeas((v) => !v)}
          aria-expanded={showIdeas}
          className="mt-2.5 flex items-center gap-1 text-[13px] font-semibold text-brand"
        >
          Suggestions
          <ChevronDown className={`h-4 w-4 transition-transform ${showIdeas ? "rotate-180" : ""}`} />
        </button>
        {showIdeas && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SEVA_SUGGESTIONS.map((s) => {
              const on = parts.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onPointerDown={(e) => e.preventDefault()} // keep focus (and the keyboard) on the text box
                  onClick={() => toggle(s)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    on ? "border-brand bg-brand text-white" : "border-line bg-white text-ink/70 hover:border-brand/50"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        )}
      </Popover>
    </>
  );
}
