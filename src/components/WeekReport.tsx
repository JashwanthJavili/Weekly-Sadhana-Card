/* eslint-disable @next/next/no-img-element -- plain <img> keeps the PDF render reliable */
import { forwardRef, type ReactNode } from "react";
import { DAY_LABELS, REFLECTIONS, ROWS, type RowDef } from "@/lib/card";
import { formatDuration, formatTime12, formatWeekRange, weekDates } from "@/lib/dates";
import { DAY_KEYS, type DayEntry, type WeekCard } from "@/lib/types";

/**
 * The PDF version of a week: built to be read at a glance (by the person and their mentor),
 * not to look like the paper card. A4 portrait, rendered off-screen and turned into a PDF.
 */

const TEAL = "#008080";
const INK = "#2f3a3a";
const MUTED = "#7a8585";
const LINE = "#dfe6e4";
const SOFT = "#f2f7f6";

const toMin = (t: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fromMin = (min: number) => {
  const v = ((Math.round(min) % 1440) + 1440) % 1440;
  return formatTime12(`${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`);
};
const nums = (xs: string[]) => xs.filter((x) => /^\d+$/.test(x)).map(Number);

/** The "Week" column: a total or an average for each row. */
function weekSummary(row: RowDef, days: DayEntry[]): { value: string; note: string } {
  const vals = days.map((d) => d[row.field]);
  if (row.kind === "time") {
    // Bed times after midnight count as "late", not "early".
    const mins = vals.map(toMin).filter((m): m is number => m !== null).map((m) => (row.field === "sleepingTime" && m < 12 * 60 ? m + 1440 : m));
    if (!mins.length) return { value: "–", note: "" };
    return { value: fromMin(mins.reduce((a, b) => a + b, 0) / mins.length), note: "average" };
  }
  if (row.kind === "rounds") {
    const r = nums(vals);
    if (!r.length) return { value: "–", note: "" };
    return { value: String(r.reduce((a, b) => a + b, 0)), note: `rounds · avg ${Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10}/day` };
  }
  if (row.kind === "duration") {
    const m = nums(vals);
    if (!m.length) return { value: "–", note: "" };
    const total = m.reduce((a, b) => a + b, 0);
    return { value: formatDuration(String(total), true) || "0m", note: "total" };
  }
  if (row.kind === "yesno") {
    const answered = vals.filter(Boolean).length;
    if (!answered) return { value: "–", note: "" };
    return { value: `${vals.filter((v) => v === "yes").length}/${answered}`, note: "attended" };
  }
  const n = vals.filter((v) => v.trim()).length;
  return n ? { value: `${n} day${n === 1 ? "" : "s"}`, note: "of seva" } : { value: "–", note: "" };
}

function Cell({ row, entry }: { row: RowDef; entry: DayEntry }): ReactNode {
  const v = entry[row.field];
  const dash = <span style={{ color: "#c3cccb" }}>–</span>;
  if (row.kind === "rounds") {
    const t = row.field2 ? entry[row.field2] : "";
    if (!v && !t) return dash;
    return (
      <>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{v || "–"}</div>
        {t && <div style={{ fontSize: 10, color: MUTED }}>{formatTime12(t)}</div>}
      </>
    );
  }
  if (!v) return dash;
  if (row.kind === "yesno")
    return v === "yes" ? (
      <span style={{ display: "inline-block", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700, color: "#0f7a4c", background: "#dcf5e8" }}>Yes</span>
    ) : (
      <span style={{ display: "inline-block", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700, color: "#b4233c", background: "#fde4e8" }}>No</span>
    );
  if (row.kind === "time") return <span style={{ fontWeight: 600 }}>{formatTime12(v)}</span>;
  if (row.kind === "duration") return <span style={{ fontWeight: 600 }}>{formatDuration(v, true)}</span>;
  return <span style={{ fontSize: 10.5, lineHeight: 1.25, wordBreak: "break-word" }}>{v}</span>;
}

export const WeekReport = forwardRef<HTMLDivElement, { card: WeekCard }>(function WeekReport({ card }, ref) {
  const dates = weekDates(card.weekStart);
  const days = DAY_KEYS.map((k) => card.days[k]);
  const filledDays = days.filter((d) => ROWS.some((r) => d[r.field] || (r.field2 && d[r.field2]))).length;
  const roundList = nums(days.map((d) => d.chantingRounds));
  const rounds = roundList.reduce((a, b) => a + b, 0);
  const japa = days.filter((d) => d.nbsClass === "yes").length;
  const gita = card.yuvaSetu === "attended" ? "Attended" : card.yuvaSetu === "not_attended" ? "Not attended" : "–";
  const p = card.profile;

  const info = (label: string, value: string) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", wordBreak: "break-word" }}>{value || "–"}</div>
    </div>
  );
  const stat = (label: string, value: string, sub?: string) => (
    <div style={{ background: SOFT, borderRadius: 12, padding: "10px 12px", border: `1px solid ${LINE}` }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: TEAL, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>
        {label}
        {sub ? ` · ${sub}` : ""}
      </div>
    </div>
  );
  const th: React.CSSProperties = { padding: "7px 4px", fontSize: 11, fontWeight: 700, color: TEAL, textAlign: "center", borderBottom: `2px solid ${TEAL}` };
  const td: React.CSSProperties = { padding: "7px 4px", textAlign: "center", verticalAlign: "middle", borderBottom: `1px solid ${LINE}`, fontSize: 12 };

  return (
    <div ref={ref} style={{ width: 794, minHeight: 1123, background: "#fff", color: INK, fontFamily: "Poppins, system-ui, sans-serif", boxSizing: "border-box", padding: 28 }}>
      {/* Header */}
      <div style={{ background: TEAL, borderRadius: 16, padding: "18px 22px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 30, fontWeight: 700, lineHeight: 1 }}>Sadhana Card</div>
          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{formatWeekRange(card.weekStart)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.5fr 1.5fr 1fr", gap: 14, marginTop: 14 }}>
          {info("Name", p.name)}
          {info("Age", p.age)}
          {info("Mentor / Siksha Guru", p.mentor)}
          {info("Phone", p.phone)}
        </div>
      </div>

      {/* At a glance */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }}>
        {stat("Days filled", `${filledDays}/7`)}
        {stat("Rounds chanted", String(rounds), roundList.length ? `avg ${Math.round((rounds / roundList.length) * 10) / 10}/day` : undefined)}
        {stat("Japa class", `${japa}/7`, "days attended")}
        {stat("Gita For Youth", gita, "Friday")}
      </div>

      {/* Daily table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 128 }} />
          {DAY_KEYS.map((k) => (
            <col key={k} />
          ))}
          <col style={{ width: 92 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Daily sadhana</th>
            {DAY_KEYS.map((k, i) => (
              <th key={k} style={th}>
                <div>{DAY_LABELS[k]}</div>
                <div style={{ fontSize: 10, fontWeight: 500, color: MUTED }}>{dates[i].getDate()}</div>
              </th>
            ))}
            <th style={{ ...th, background: SOFT, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>Week</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const s = weekSummary(row, days);
            return (
              <tr key={row.id}>
                <td style={{ ...td, textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <img src={row.icon} alt="" style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{row.title}</span>
                  </div>
                </td>
                {DAY_KEYS.map((k) => (
                  <td key={k} style={td}>
                    <Cell row={row} entry={card.days[k]} />
                  </td>
                ))}
                <td style={{ ...td, background: SOFT }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEAL }}>{s.value}</div>
                  {s.note && <div style={{ fontSize: 9.5, color: MUTED, lineHeight: 1.2 }}>{s.note}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Reflections */}
      <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: TEAL }}>Reflections</div>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {REFLECTIONS.map((q) => {
          const a = card.reflections[q.key].trim();
          return (
            <div key={q.key} style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "10px 12px", display: "flex", gap: 10 }}>
              <img src={q.icon} alt="" style={{ width: 26, height: 26, objectFit: "contain", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: MUTED }}>{q.question.replace(/^\d\.\s*/, "")}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", color: a ? INK : "#b7c0bf", marginTop: 2 }}>{a || "–"}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: TEAL, fontWeight: 600 }}>In Service of HG Pranavananda Prabhuji</div>
    </div>
  );
});
