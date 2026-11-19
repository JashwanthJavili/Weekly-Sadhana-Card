
"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccountRow } from "@/components/AccountButton";
import { useAccount } from "@/components/AccountProvider";
import { ChevronLeft, ChevronRight, Download, MoreVertical, Pencil, Share, Trash } from "@/components/icons";
import { ConfirmDialog } from "@/components/Modal";
import { Popover } from "@/components/pickers";
import { SadhanaCard } from "@/components/SadhanaCard";
import { ShareDialog } from "@/components/ShareDialog";
import { SiteFooter } from "@/components/SiteFooter";
import { StreakCard } from "@/components/StreakCard";
import { FormatOptions, InfoButton } from "@/components/ui";
import { LockedError } from "@/lib/account";
import { cardFileName, cardHref, cardProgress, mergeProfile } from "@/lib/card";
import { formatWeekRange, parseISODate, shiftWeek, todayISO, weekStartISO } from "@/lib/dates";
import { buildCardFile, downloadBlob, type CardFormat } from "@/lib/export";
import { repo } from "@/lib/storage";
import { computeStreak } from "@/lib/streak";
import type { WeekCard } from "@/lib/types";

/** "This week", "Last week", "In 2 weeks", … */
function relativeWeek(weekStart: string): string {
  const a = parseISODate(weekStart);
  const b = parseISODate(weekStartISO(new Date()));
  if (!a || !b) return "";
  const diff = Math.round((a.getTime() - b.getTime()) / (7 * 24 * 3600 * 1000));
  if (diff === 0) return "This week";
  if (diff === -1) return "Last week";
  if (diff === 1) return "Next week";
  return diff < 0 ? `${-diff} weeks ago` : `In ${diff} weeks`;
}

/** Last list shown (per account), so coming back from a card shows it instantly; refreshed right after. */
let lastCards: { uid: string; list: WeekCard[] } | null = null;

export default function HomePage() {
  const acc = useAccount();
  const uid = acc.user?.uid ?? null;
  const [picked, setPicked] = useState("");
  const [cards, setCards] = useState<WeekCard[] | null>(() => (lastCards && lastCards.uid === uid ? lastCards.list : null));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<WeekCard | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const load = useCallback(() => {
    setLoadError(null);
    const seq = ++loadSeq.current; // ignore answers from an older load
    let fresh = false;
    // Instant: cards already on this device. Then the up-to-date list from the server.
    repo
      .listCachedCards()
      .then((cached) => {
        if (cached && !fresh && seq === loadSeq.current) setCards(cached);
      })
      .catch(() => undefined);
    repo
      .listCards()
      .then((list) => {
        fresh = true;
        if (seq === loadSeq.current) setCards(list);
      })
      .catch((e: unknown) => {
        if (seq !== loadSeq.current || e instanceof LockedError) return; // the unlock dialog is showing
        setLoadError(e instanceof Error ? e.message : "Could not load your cards.");
      });
  }, []);

  useEffect(() => {
    setPicked(todayISO());
  }, []);

  // Remember the list for the next visit to this page.
  useEffect(() => {
    if (cards && uid) lastCards = { uid, list: cards };
  }, [cards, uid]);

  // (Re)load whenever the account or its key changes (sign in / unlock / sign out).
  const shownUid = useRef(uid);
  useEffect(() => {
    if (acc.phase === "ready" || acc.phase === "needs-setup") {
      if (shownUid.current !== uid) {
        shownUid.current = uid;
        setCards(lastCards && lastCards.uid === uid ? lastCards.list : null); // never show another account's cards
      }
      load();
    } else if (acc.phase === "error") {
      setLoadError(acc.error);
    }
  }, [acc.phase, acc.version, acc.error, uid, load]);

  const streak = useMemo(() => (cards ? computeStreak(cards) : null), [cards]);

  const pickedDate = parseISODate(picked);
  const pickedWeek = pickedDate ? weekStartISO(pickedDate) : null;
  const existing = pickedWeek ? cards?.find((c) => c.weekStart === pickedWeek) : undefined;

  // ⋮ menu on a saved card
  const [menu, setMenu] = useState<{ card: WeekCard; el: HTMLElement; step?: "share" | "download" } | null>(null);
  // PDF export: the card is rendered off-screen, then turned into a PDF.
  const [exporting, setExporting] = useState<{ card: WeekCard; kind: "download" | "share"; format: CardFormat } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [share, setShare] = useState<{ file: File; text: string } | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const startExport = async (card: WeekCard, kind: "download" | "share", format: CardFormat) => {
    setMenu(null);
    setExportError(null);
    const saved = await repo.getProfile().catch(() => null);
    setExporting({ card: { ...card, profile: mergeProfile(card.profile, saved) }, kind, format });
  };

  useEffect(() => {
    if (!exporting) return;
    let cancelled = false;
    (async () => {
      try {
        // Let the off-screen copy render first.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (!exportRef.current) throw new Error("export node missing");
        const { card, kind, format } = exporting;
        const file = await buildCardFile(exportRef.current, format, cardFileName(card));
        if (cancelled) return;
        if (kind === "download") downloadBlob(file, file.name);
        else
          setShare({
            file,
            text: `Hare Krishna! Here is my Sadhana Card for ${formatWeekRange(card.weekStart)}${card.profile.name ? ` — ${card.profile.name}` : ""}.`,
          });
      } catch (e) {
        console.error(e);
        if (!cancelled) setExportError("Could not prepare your card. Please try again.");
      } finally {
        if (!cancelled) setExporting(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exporting]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await repo.deleteCard(toDelete.weekStart);
      setCards((prev) => prev?.filter((x) => x.weekStart !== toDelete.weekStart) ?? null);
      setToDelete(null);
    } catch {
      setDeleteError("Could not delete. Please check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    // Exactly one screen tall: only the list of cards scrolls, the footer is always visible.
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="relative shrink-0 bg-brand px-4 py-3.5 text-center text-white">
        <InfoButton light topic="security" className="absolute top-1/2 right-2 -translate-y-1/2" />
        <h1 className="font-serif text-[26px] leading-none font-bold sm:text-[32px]">Sadhana Card</h1>
        <img src="/icons/flourish.png" alt="" className="mx-auto mt-1.5 h-[8px] w-[150px]" />
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-3 px-4 pt-4 pb-3">
        {/* Account (optional sign-in) */}
        <AccountRow />

        {/* Streak */}
        {streak && <StreakCard info={streak} />}

        {/* Choose a week */}
        <section className="shrink-0 rounded-2xl bg-white p-3 shadow-md ring-1 ring-black/5 sm:p-4">
          <div className="flex items-center gap-1 rounded-xl bg-paper ring-1 ring-line">
            <button
              type="button"
              onClick={() => pickedWeek && setPicked(shiftWeek(pickedWeek, -1))}
              aria-label="Previous week"
              className="flex h-14 w-12 shrink-0 items-center justify-center rounded-l-xl text-ink/60 hover:bg-band active:bg-band"
            >
              <ChevronLeft />
            </button>
            <label className="relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center py-1.5 text-center" title="Pick any date">
              <span className="truncate text-[16px] font-semibold text-ink">{pickedWeek ? formatWeekRange(pickedWeek) : "…"}</span>
              <span className={`text-[12px] font-medium ${existing ? "text-brand" : "text-ink/50"}`}>
                {pickedWeek ? relativeWeek(pickedWeek) : ""}
                {existing ? " · saved" : ""}
              </span>
              <input
                type="date"
                value={pickedWeek ?? ""}
                onChange={(e) => e.target.value && setPicked(e.target.value)}
                aria-label="Pick any date"
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <button
              type="button"
              onClick={() => pickedWeek && setPicked(shiftWeek(pickedWeek, 1))}
              aria-label="Next week"
              className="flex h-14 w-12 shrink-0 items-center justify-center rounded-r-xl text-ink/60 hover:bg-band active:bg-band"
            >
              <ChevronRight />
            </button>
          </div>
          <button
            type="button"
            onClick={() => pickedWeek && window.location.assign(cardHref(pickedWeek))}
            disabled={!pickedWeek}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            {existing ? "Open card" : "Start card"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </section>

        {/* Saved cards — the only part that scrolls */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="font-serif text-lg font-bold text-ink">My cards</h2>
            {cards && cards.length > 0 && <span className="text-xs text-ink/50">{cards.length} saved</span>}
          </div>

          {exportError && (
            <p role="alert" className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-rose-200">
              {exportError}
            </p>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl">
            {loadError ? (
              <div className="rounded-2xl border border-rose-200 bg-white p-5 text-center text-sm text-rose-700">
                <p className="mb-3">{loadError}</p>
                <button className="btn-solid" onClick={load}>
                  Try again
                </button>
              </div>
            ) : cards === null ? (
              <div className="space-y-2">
                <div className="h-[68px] animate-pulse rounded-2xl bg-white/70" />
                <div className="h-[68px] animate-pulse rounded-2xl bg-white/50" />
              </div>
            ) : cards.length === 0 ? (
              <div className="flex h-full min-h-[110px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-white/50 p-6 text-center text-sm text-ink/60">
                No cards yet.
                <span className="text-ink/45">Choose a date above to start your first week.</span>
              </div>
            ) : (
              <ul className="space-y-2">
                {cards.map((c) => {
                  const { filled, total } = cardProgress(c);
                  const done = filled === total;
                  const pct = Math.round((filled / total) * 100);
                  return (
                    <li key={c.weekStart} className="flex items-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                      <a href={cardHref(c.weekStart)} className="flex min-w-0 flex-1 items-center gap-3 rounded-l-2xl p-3.5 active:bg-band">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                            done ? "bg-emerald-100 text-emerald-700" : "bg-brand/10 text-brand"
                          }`}
                        >
                          {done ? "Done" : `${pct}%`}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-ink">{formatWeekRange(c.weekStart)}</span>
                          <span className="block text-xs text-ink/55">
                            {done ? "All filled" : `${filled}/${total} filled`}
                          </span>
                        </span>
                        <ChevronRight className="h-5 w-5 text-ink/25" />
                      </a>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-label={`More options for ${formatWeekRange(c.weekStart)}`}
                        disabled={!!exporting}
                        onClick={(e) => {
                          const el = e.currentTarget;
                          setMenu((m) => (m ? null : { card: c, el }));
                        }}
                        className="mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/45 hover:bg-band active:bg-band disabled:opacity-40"
                      >
                        {exporting?.card.weekStart === c.weekStart ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/25 border-t-brand" aria-label="Preparing PDF" />
                        ) : (
                          <MoreVertical className="h-5 w-5" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

      </main>

      <SiteFooter className="shrink-0" />

      <Popover
        anchor={menu?.el ?? null}
        open={!!menu}
        onClose={() => setMenu(null)}
        title={menu ? (menu.step === "share" ? "Send to mentor as…" : menu.step === "download" ? "Download as…" : formatWeekRange(menu.card.weekStart)) : ""}
      >
        {menu?.step ? (
          <FormatOptions onPick={(f) => void startExport(menu.card, menu.step!, f)} />
        ) : (
          menu && (
            <div className="min-w-[240px] space-y-1">
              <MenuItem
                icon={<Pencil className="h-[18px] w-[18px]" />}
                title="Open card"
                sub="View or edit this week"
                onClick={() => window.location.assign(cardHref(menu.card.weekStart))}
              />
              <MenuItem
                icon={<Share className="h-[18px] w-[18px]" />}
                title="Send to mentor"
                sub="As a PDF or image, on WhatsApp or any app"
                onClick={() => setMenu({ ...menu, step: "share" })}
              />
              <MenuItem
                icon={<Download className="h-[18px] w-[18px]" />}
                title="Download"
                sub="Save as a PDF or image"
                onClick={() => setMenu({ ...menu, step: "download" })}
              />
              <MenuItem
                danger
                icon={<Trash className="h-[18px] w-[18px]" />}
                title="Delete"
                sub="Remove this card for good"
                onClick={() => {
                  const c = menu.card;
                  setMenu(null);
                  setDeleteError(null);
                  setToDelete(c);
                }}
              />
            </div>
          )
        )}
      </Popover>

      <ShareDialog file={share?.file ?? null} text={share?.text ?? ""} onClose={() => setShare(null)} />

      {/* Off-screen copy used to build the PDF */}
      {exporting && (
        <div className="export-host" aria-hidden inert>
          <SadhanaCard ref={exportRef} card={exporting.card} mode="export" />
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this card?"
        message={
          <>
            The card for <b className="text-ink">{toDelete ? formatWeekRange(toDelete.weekStart) : ""}</b> will be removed for good.
            {deleteError && <span className="mt-2 block text-rose-600">{deleteError}</span>}
          </>
        }
        confirmLabel="Delete"
        danger
        busy={deleting}
        icon={<Trash className="h-6 w-6" />}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function MenuItem(props: { icon: ReactNode; title: string; sub: string; onClick: () => void; danger?: boolean }) {
  const { icon, title, sub, onClick, danger } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${danger ? "hover:bg-rose-50 active:bg-rose-50" : "hover:bg-band active:bg-band"}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? "bg-rose-50 text-rose-600" : "bg-brand/10 text-brand"}`}>{icon}</span>
      <span className="min-w-0">
        <span className={`block font-semibold ${danger ? "text-rose-600" : "text-ink"}`}>{title}</span>
        <span className="block text-xs text-ink/55">{sub}</span>
      </span>
    </button>
  );
}
