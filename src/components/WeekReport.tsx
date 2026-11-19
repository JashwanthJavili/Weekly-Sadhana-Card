/* eslint-disable @next/next/no-img-element -- plain <img> keeps the image render reliable */
import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { DAY_LABELS, REFLECTIONS, ROWS, type RowDef } from "@/lib/card";
import { formatDuration, formatTime12, formatWeekRange, weekDates } from "@/lib/dates";
import { DAY_KEYS, type DayEntry, type WeekCard } from "@/lib/types";

/**
 * The shareable image of a week, made so a mentor can see the devotee's sadhana at a glance:
 * every entry is colour-coded against a simple target (green = on target, amber = close,
 * red = needs attention), with a score, highlights and the reflections.
 * Rendered off-screen and turned into a PNG.
 */

/* ───────── targets (change here) ───────── */
const TARGET = {
  wakeBy: 5 * 60, // on target: up by 5:00 AM
  wakeOkBy: 6 * 60, // close: by 6:00 AM
  sleepBy: 22 * 60, // on target: in bed by 10:00 PM
  sleepOkBy: 23 * 60, // close: by 11:00 PM
  rounds: 16,
  roundsOk: 8,
  exercise: 20, // minutes
  reading: 30,
  screenMax: 60,
  screenOkMax: 120,
  daySleepOkMax: 30,
};

type Rating = "good" | "ok" | "low" | null;

const C = {
  teal: "#007a7a",
  ink: "#24302f",
  muted: "#6f7b7a",
  line: "#e3e9e8",
  soft: "#f3f7f6",
  good: { bg: "#d9f2e4", fg: "#0b6b40" },
  ok: { bg: "#fdefc8", fg: "#8a5a00" },
  low: { bg: "#fde0e3", fg: "#a3162f" },
};

const toMin = (t: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const num = (v: string) => (/^\d+$/.test(v) ? Number(v) : null);
const timeOf = (min: number) => {
  const v = ((Math.round(min) % 1440) + 1440) % 1440;
  return formatTime12(`${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`);
};
/** Bed times after midnight count as late (e.g. 1 AM → 25:00). */
const bedMin = (t: string) => {
  const m = toMin(t);
  return m === null ? null : m < 12 * 60 ? m + 1440 : m;
};

/** How one day's entry for a row compares with the target. */
function rate(row: RowDef, e: DayEntry): Rating {
  const v = e[row.field];
  switch (row.field) {
    case "wakeUp": {
      const m = toMin(v);
      return m === null ? null : m <= TARGET.wakeBy ? "good" : m <= TARGET.wakeOkBy ? "ok" : "low";
    }
    case "chantingRounds": {
      const r = num(v);
      return r === null ? null : r >= TARGET.rounds ? "good" : r >= TARGET.roundsOk ? "ok" : "low";
    }
    case "exercise": {
      const m = num(v);
      return m === null ? null : m >= TARGET.exercise ? "good" : m > 0 ? "ok" : "low";
    }
    case "nbsClass":
      return v === "yes" ? "good" : v === "no" ? "low" : null;
    case "seva":
      return v.trim() ? "good" : null;
    case "daySleep": {
      const m = num(v);
      return m === null ? null : m === 0 ? "good" : m <= TARGET.daySleepOkMax ? "ok" : "low";
    }
    case "screenTime": {
      const m = num(v);
      return m === null ? null : m <= TARGET.screenMax ? "good" : m <= TARGET.screenOkMax ? "ok" : "low";
    }
    case "reading": {
      const m = num(v);
      return m === null ? null : m >= TARGET.reading ? "good" : m > 0 ? "ok" : "low";
    }
    case "sleepingTime": {
      const m = bedMin(v);
      return m === null ? null : m <= TARGET.sleepBy ? "good" : m <= TARGET.sleepOkBy ? "ok" : "low";
    }
    default:
      return null;
  }
}

/** Text shown in a day cell. */
function cellText(row: RowDef, e: DayEntry): { main: string; sub?: string } | null {
  const v = e[row.field];
  if (row.kind === "rounds") {
    const t = row.field2 ? e[row.field2] : "";
    if (!v && !t) return null;
    return { main: v || "–", sub: t ? formatTime12(t) : undefined };
  }
  if (!v) return null;
  if (row.kind === "yesno") return { main: v === "yes" ? "Yes" : "No" };
  if (row.kind === "time") {
    const [time, ap] = formatTime12(v).split(" ");
    return { main: time, sub: ap };
  }
  if (row.kind === "duration") return { main: formatDuration(v, true) || "0m" };
  return { main: v };
}

/** "This week" column: total / average plus how many days were on target. */
function weekCell(row: RowDef, days: DayEntry[]): { main: string; sub: string; rating: Rating } {
  const vals = days.map((d) => d[row.field]);
  const ratings = days.map((d) => rate(row, d)).filter((r): r is Exclude<Rating, null> => r !== null);
  const good = ratings.filter((r) => r === "good").length;
  const overall: Rating = !ratings.length ? null : good / ratings.length >= 0.7 ? "good" : good / ratings.length >= 0.4 ? "ok" : "low";
  const onTarget = ratings.length ? `${good}/${ratings.length} on target` : "";

  if (row.kind === "time") {
    const mins = vals.map(row.field === "sleepingTime" ? bedMin : toMin).filter((m): m is number => m !== null);
    if (!mins.length) return { main: "–", sub: "", rating: null };
    return { main: timeOf(mins.reduce((a, b) => a + b, 0) / mins.length), sub: `avg · ${onTarget}`, rating: overall };
  }
  if (row.kind === "rounds") {
    const r = vals.map(num).filter((x): x is number => x !== null);
    if (!r.length) return { main: "–", sub: "", rating: null };
    return { main: `${r.reduce((a, b) => a + b, 0)}`, sub: `rounds · ${onTarget}`, rating: overall };
  }
  if (row.kind === "duration") {
    const m = vals.map(num).filter((x): x is number => x !== null);
    if (!m.length) return { main: "–", sub: "", rating: null };
    return { main: formatDuration(String(m.reduce((a, b) => a + b, 0)), true) || "0m", sub: `total · ${onTarget}`, rating: overall };
  }
  if (row.kind === "yesno") {
    const answered = vals.filter(Boolean).length;
    if (!answered) return { main: "–", sub: "", rating: null };
    return { main: `${vals.filter((v) => v === "yes").length}/7`, sub: "days attended", rating: overall };
  }
  const n = vals.filter((v) => v.trim()).length;
  return n ? { main: `${n}/7`, sub: "days of seva", rating: n >= 5 ? "good" : n >= 3 ? "ok" : "low" } : { main: "–", sub: "", rating: null };
}

const tint = (r: Rating): CSSProperties => (r ? { background: C[r].bg, color: C[r].fg } : {});

export const WeekReport = forwardRef<HTMLDivElement, { card: WeekCard }>(function WeekReport({ card }, ref) {
  const dates = weekDates(card.weekStart);
  const days = DAY_KEYS.map((k) => card.days[k]);
  const p = card.profile;

  // Score over the whole week (9 items × 7 days): on target = 1, close = ½, needs attention or empty = 0.
  const all = ROWS.flatMap((row) => days.map((d) => rate(row, d))).filter((r): r is Exclude<Rating, null> => r !== null);
  const filledCells = ROWS.reduce((n, row) => n + days.filter((d) => d[row.field] || (row.field2 && d[row.field2])).length, 0);
  const totalCells = ROWS.length * 7;
  const score = Math.round((all.reduce((s, r) => s + (r === "good" ? 1 : r === "ok" ? 0.5 : 0), 0) / totalCells) * 100);
  const scoreRating: Rating = !all.length ? null : score >= 75 ? "good" : score >= 50 ? "ok" : "low";
  const scoreWord = !all.length ? "Not filled yet" : score >= 75 ? "Excellent week" : score >= 50 ? "Good, keep going" : "Needs attention";

  const rounds = days.map((d) => num(d.chantingRounds)).filter((x): x is number => x !== null);
  const roundsTotal = rounds.reduce((a, b) => a + b, 0);
  const fullRoundDays = rounds.filter((r) => r >= TARGET.rounds).length;
  const wakes = days.map((d) => toMin(d.wakeUp)).filter((x): x is number => x !== null);
  const avgWake = wakes.length ? wakes.reduce((a, b) => a + b, 0) / wakes.length : null;
  const japa = days.filter((d) => d.nbsClass === "yes").length;
  const japaMarked = days.filter((d) => d.nbsClass).length;
  const gita = card.yuvaSetu === "attended" ? "attended" : card.yuvaSetu === "not_attended" ? "missed" : "not marked";
  const dayFilled = days.map((d) => ROWS.filter((r) => d[r.field] || (r.field2 && d[r.field2])).length);

  const info = (label: string, value: string, flex: number) => (
    <div style={{ flex, minWidth: 0 }}>
      <div style={{ fontSize: 10.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", wordBreak: "break-word", lineHeight: 1.25 }}>{value || "–"}</div>
    </div>
  );
  const highlight = (label: string, value: ReactNode, sub: string, r: Rating) => (
    <div style={{ flex: 1, borderRadius: 14, padding: "11px 12px", border: `1px solid ${C.line}`, background: "#fff" }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: C.muted }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15, marginTop: 3, color: r ? C[r].fg : C.ink }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 1, lineHeight: 1.3 }}>{sub}</div>
    </div>
  );
  const th: CSSProperties = { padding: "8px 2px", fontSize: 12, fontWeight: 700, color: C.teal, textAlign: "center" };

  return (
    <div ref={ref} style={{ width: 820, background: "#fff", color: C.ink, fontFamily: "Poppins, system-ui, sans-serif", boxSizing: "border-box", padding: 26 }}>
      {/* Header */}
      <div style={{ background: C.teal, borderRadius: 18, padding: "18px 22px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 32, fontWeight: 700, lineHeight: 1 }}>Sadhana Card</div>
          <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap" }}>{formatWeekRange(card.weekStart)}</div>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
          {info("Name", p.name, 1.3)}
          {info("Age", p.age, 0.45)}
          {info("Mentor / Siksha Guru", p.mentor, 1.6)}
          {info("Phone", p.phone, 1)}
        </div>
      </div>

      {/* Score + highlights */}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1.25, borderRadius: 14, padding: "12px 14px", ...tint(scoreRating), background: scoreRating ? C[scoreRating].bg : C.soft }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.8 }}>Sadhana score</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{all.length ? `${score}%` : "–"}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{scoreWord}</span>
          </div>
          <div style={{ height: 7, borderRadius: 99, background: "rgba(0,0,0,0.08)", marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${score}%`, borderRadius: 99, background: scoreRating ? C[scoreRating].fg : C.muted }} />
          </div>
          <div style={{ fontSize: 11, marginTop: 5, opacity: 0.85 }}>
            {filledCells}/{totalCells} entries filled
          </div>
        </div>
        {highlight(
          "Chanting",
          `${roundsTotal} rounds`,
          rounds.length ? `${fullRoundDays}/7 days with ${TARGET.rounds} rounds` : "not filled",
          rounds.length ? (fullRoundDays >= 5 ? "good" : fullRoundDays >= 3 ? "ok" : "low") : null,
        )}
        {highlight(
          "Avg wake-up",
          avgWake === null ? "–" : timeOf(avgWake),
          `target ${timeOf(TARGET.wakeBy)}`,
          avgWake === null ? null : avgWake <= TARGET.wakeBy ? "good" : avgWake <= TARGET.wakeOkBy ? "ok" : "low",
        )}
        {highlight(
          "Japa class",
          `${japa}/7`,
          `Gita For Youth: ${gita}`,
          !japaMarked ? null : japa >= 5 ? "good" : japa >= 3 ? "ok" : "low",
        )}
      </div>

      {/* Daily table */}
      <div style={{ marginTop: 16, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 138 }} />
            {DAY_KEYS.map((k) => (
              <col key={k} />
            ))}
            <col style={{ width: 104 }} />
          </colgroup>
          <thead>
            <tr style={{ background: C.soft }}>
              <th style={{ ...th, textAlign: "left", paddingLeft: 12 }}>Daily sadhana</th>
              {DAY_KEYS.map((k, i) => (
                <th key={k} style={th}>
                  <div>{DAY_LABELS[k]}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 500, color: C.muted }}>{dates[i].getDate()}</div>
                </th>
              ))}
              <th style={{ ...th, color: "#fff", background: C.teal }}>This week</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const w = weekCell(row, days);
              return (
                <tr key={row.id}>
                  <td style={{ padding: "6px 8px 6px 10px", borderTop: `1px solid ${C.line}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <img src={row.icon} alt="" style={{ width: 26, height: 26, objectFit: "contain", flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2 }}>{row.title}</span>
                    </div>
                  </td>
                  {DAY_KEYS.map((k) => {
                    const e = card.days[k];
                    const t = cellText(row, e);
                    const r = rate(row, e);
                    return (
                      <td key={k} style={{ padding: 3, borderTop: `1px solid ${C.line}` }}>
                        <div
                          style={{
                            minHeight: 38,
                            borderRadius: 9,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            padding: "3px 2px",
                            ...(t ? tint(r) : { color: "#c5cdcc" }),
                          }}
                        >
                          {t ? (
                            row.kind === "text" ? (
                              <span style={{ fontSize: 10.5, lineHeight: 1.2, fontWeight: 600, wordBreak: "break-word" }}>{t.main}</span>
                            ) : (
                              <>
                                <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>{t.main}</span>
                                {t.sub && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>{t.sub}</span>}
                              </>
                            )
                          ) : (
                            "–"
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ padding: 3, borderTop: `1px solid ${C.line}`, background: C.soft }}>
                    <div style={{ textAlign: "center", padding: "2px 2px" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: w.rating ? C[w.rating].fg : C.muted }}>{w.main}</div>
                      {w.sub && <div style={{ fontSize: 9.5, lineHeight: 1.2, color: C.muted }}>{w.sub}</div>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {/* How complete each day is */}
            <tr>
              <td style={{ padding: "8px 8px 8px 12px", borderTop: `2px solid ${C.line}`, fontSize: 11.5, fontWeight: 600, color: C.muted }}>Day filled</td>
              {dayFilled.map((n, i) => (
                <td key={i} style={{ padding: "8px 5px", borderTop: `2px solid ${C.line}` }}>
                  <div style={{ height: 6, borderRadius: 99, background: C.line, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(n / ROWS.length) * 100}%`, background: n >= 7 ? C.good.fg : n >= 4 ? "#d39b14" : n ? C.low.fg : "transparent" }} />
                  </div>
                  <div style={{ fontSize: 10, textAlign: "center", color: C.muted, marginTop: 3 }}>
                    {n}/{ROWS.length}
                  </div>
                </td>
              ))}
              <td style={{ borderTop: `2px solid ${C.line}`, background: C.soft }} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 14px", marginTop: 10, fontSize: 11, color: C.muted }}>
        {(
          [
            ["good", "On target"],
            ["ok", "Close"],
            ["low", "Needs attention"],
          ] as const
        ).map(([r, label]) => (
          <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: C[r].bg, border: `1px solid ${C[r].fg}33` }} />
            {label}
          </span>
        ))}
        <span>
          Targets: up by {timeOf(TARGET.wakeBy)} · {TARGET.rounds} rounds · exercise {TARGET.exercise}m · reading {TARGET.reading}m · screen ≤ {TARGET.screenMax}m · no day sleep · bed by{" "}
          {timeOf(TARGET.sleepBy)}
        </span>
      </div>

      {/* Reflections */}
      <div style={{ marginTop: 16, fontSize: 14, fontWeight: 700, color: C.teal }}>Reflections</div>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {REFLECTIONS.map((q) => {
          const a = card.reflections[q.key].trim();
          return (
            <div key={q.key} style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 12px", display: "flex", gap: 10 }}>
              <img src={q.icon} alt="" style={{ width: 28, height: 28, objectFit: "contain", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{q.question.replace(/^\d\.\s*/, "")}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", color: a ? C.ink : "#b7c0bf", marginTop: 2 }}>{a || "–"}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11.5, color: C.teal, fontWeight: 600 }}>In Service of HG Pranavananda Prabhuji</div>
    </div>
  );
});
