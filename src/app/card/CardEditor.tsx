"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- plain links on purpose: Next client navigation in a static export can open the raw .txt payload after a deploy */

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Home, Share } from "@/components/icons";
import { SadhanaCard } from "@/components/SadhanaCard";
import { InfoButton, PrivacyNotice } from "@/components/ui";
import { blankCard, cardHref, cardProgress, isCardEmpty, mergeProfile, cardFileName } from "@/lib/card";
import { formatWeekRange, parseISODate, shiftWeek, todayISO, weekStartISO } from "@/lib/dates";
import { buildCardPdf, downloadCardPdf, downloadCardPng } from "@/lib/export";
import { LockedError } from "@/lib/account";
import { useAccount } from "@/components/AccountProvider";
import { ShareDialog } from "@/components/ShareDialog";
import { repo } from "@/lib/storage";
import { useTyping } from "@/lib/useKeyboard";
import type { Profile, WeekCard } from "@/lib/types";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 700;

export default function CardEditor() {
  const params = useSearchParams();
  const week = params.get("week") ?? "";
  // No ?week= → this week.
  const date = week ? parseISODate(week) : new Date();
  const weekStart = date ? weekStartISO(date) : null;

  const [card, setCard] = useState<WeekCard | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "pdf" | "png" | "share">(null);
  const [share, setShare] = useState<File | null>(null);
  const [today, setToday] = useState<string>("");

  const cardRef = useRef<WeekCard | null>(null);
  const dirtyRef = useRef(false);
  const persistedRef = useRef(false); // does this week already exist in storage?
  const exportRef = useRef<HTMLDivElement>(null);

  cardRef.current = card;

  // Snap any date in the URL to the Monday of its week.
  useEffect(() => {
    if (weekStart && weekStart !== week) window.history.replaceState(null, "", cardHref(weekStart));
  }, [week, weekStart]);

  // Load (or create) the card for this week.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const acc = useAccount();
  const typing = useTyping(); // hide the bottom bar while the keyboard is up
  const accountReady = acc.phase === "ready" || acc.phase === "needs-setup";
  useEffect(() => {
    if (!weekStart || weekStart !== week) return;
    if (acc.phase === "error") {
      setLoadError(acc.error);
      return;
    }
    if (!accountReady) return; // signing in / locked: the account dialogs handle it
    let cancelled = false;
    setToday(todayISO());
    setLoadError(null);
    setCard(null);
    (async () => {
      try {
        const [existing, savedProfile] = await Promise.all([repo.getCard(weekStart), repo.getProfile()]);
        // Your details are shared by all weeks: fill any blanks from the saved details.
        const fresh = existing ? { ...existing, profile: mergeProfile(existing.profile, savedProfile) } : blankCard(weekStart, savedProfile);
        if (cancelled) return;
        persistedRef.current = !!existing;
        dirtyRef.current = false;
        setCard(fresh);
        setSavedAt(existing?.updatedAt ?? null);
        setSaveState(existing ? "saved" : "idle");
        setError(null);
      } catch (e) {
        if (cancelled || e instanceof LockedError) return;
        setLoadError(e instanceof Error ? e.message : "Could not load this card.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [week, weekStart, reload, accountReady, acc.phase, acc.error, acc.version]);

  const persist = useCallback(async (override?: WeekCard) => {
    const current = override ?? cardRef.current;
    if (!current) return;
    const p0 = current.profile;
    const hasProfile = !!(p0.name || p0.age || p0.mentor || p0.phone);
    // Don't create empty cards just because someone opened a week — but do keep their details.
    if (!persistedRef.current && isCardEmpty(current) && !override) {
      try {
        if (hasProfile) await repo.saveProfile(p0);
        dirtyRef.current = false;
        setSaveState(hasProfile ? "saved" : "idle");
        if (hasProfile) setSavedAt(new Date().toISOString());
      } catch (e) {
        setSaveState("error");
        setError(e instanceof Error ? e.message : "Could not save.");
      }
      return;
    }
    try {
      setSaveState("saving");
      const saved = await repo.saveCard(current);
      const p = current.profile;
      if (p.name || p.age || p.mentor || p.phone) await repo.saveProfile(p);
      persistedRef.current = true;
      dirtyRef.current = false;
      setSavedAt(saved.updatedAt);
      setSaveState("saved");
      setError(null);
    } catch (e) {
      setSaveState("error");
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  }, []);

  // Debounced autosave.
  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(() => void persist(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [card, saveState, persist]);

  // Never lose typing when the tab is closed / hidden or the user navigates away.
  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current) void persist();
    };
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [persist]);

  const onChange = useCallback((fn: (c: WeekCard) => WeekCard) => {
    setCard((prev) => (prev ? fn(prev) : prev));
    dirtyRef.current = true;
    setSaveState("dirty");
  }, []);

  const goToWeek = (iso: string) => {
    const d = parseISODate(iso);
    if (!d) return;
    if (dirtyRef.current) void persist();
    // Same page, new week: update the address without a server round-trip.
    window.history.pushState(null, "", cardHref(weekStartISO(d)));
  };

  const download = async (kind: "pdf" | "png") => {
    if (!card || !exportRef.current) return;
    setBusy(kind);
    setError(null);
    try {
      // Save in the background — the download must not wait for the network.
      if (dirtyRef.current || !persistedRef.current) void persist(card);
      const name = cardFileName(card);
      if (kind === "pdf") await downloadCardPdf(exportRef.current, `${name}.pdf`);
      else await downloadCardPng(exportRef.current, `${name}.png`);
    } catch (e) {
      console.error(e);
      setError("Download failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const shareText = card
    ? `Hare Krishna! Here is my Sadhana Card for ${formatWeekRange(card.weekStart)}${card.profile.name ? ` — ${card.profile.name}` : ""}.`
    : "";

  /** Step 1 of "Send to mentor": make the PDF (phones need a fresh tap to share, see step 2). */
  const prepareShare = async () => {
    if (!card || !exportRef.current) return;
    setBusy("share");
    setError(null);
    try {
      if (dirtyRef.current || !persistedRef.current) void persist(card);
      const blob = await buildCardPdf(exportRef.current);
      setShare(new File([blob], `${cardFileName(card)}.pdf`, { type: "application/pdf" }));
    } catch (e) {
      console.error(e);
      setError("Could not prepare the PDF. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  /* ───────── invalid URL ───────── */
  if (!weekStart) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="mb-4">That date doesn&apos;t look right.</p>
        <a href="/" className="font-semibold text-brand underline">
          Back to my cards
        </a>
      </main>
    );
  }

  const progress = card ? cardProgress(card) : null;

  const onDownload = (kind: "pdf" | "png" | "print" | "share") => {
    if (kind === "print") window.print();
    else if (kind === "share") void prepareShare();
    else void download(kind);
  };

  const weekNav = (
    <div className="flex min-w-0 items-center">
      <button className="flex h-9 w-9 items-center justify-center rounded-full text-ink/70 hover:bg-band" onClick={() => goToWeek(shiftWeek(weekStart, -1))} aria-label="Previous week">
        <ChevronLeft />
      </button>
      <label className="relative cursor-pointer truncate rounded-lg px-1.5 py-1 text-[15px] font-semibold text-ink hover:bg-band">
        {formatWeekRange(weekStart)}
        <input
          type="date"
          value={weekStart}
          onChange={(e) => e.target.value && goToWeek(e.target.value)}
          aria-label="Pick a date to open its week"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <button className="flex h-9 w-9 items-center justify-center rounded-full text-ink/70 hover:bg-band" onClick={() => goToWeek(shiftWeek(weekStart, 1))} aria-label="Next week">
        <ChevronRight />
      </button>
    </div>
  );

  return (
    <main className="flex min-h-dvh flex-col">
      {/* ───────── Top bar ───────── */}
      <div className="screen-only sticky top-0 z-20 border-b border-black/[0.06] bg-white">
        <div className="mx-auto flex h-14 max-w-[900px] items-center gap-1 px-2 lg:px-4">
          <a
            href="/"
            onClick={(e) => {
              // Finish saving first, then open the dashboard.
              if (!dirtyRef.current) return;
              e.preventDefault();
              void Promise.race([persist(), new Promise((r) => setTimeout(r, 2000))]).finally(() => window.location.assign("/"));
            }}
            className="flex h-9 items-center gap-1 rounded-full px-2 text-sm font-semibold text-ink/80 hover:bg-band"
            aria-label="All my cards"
          >
            <Home className="h-5 w-5" />
            <span className="hidden lg:inline">My cards</span>
          </a>
          <div className="flex flex-1 justify-center lg:flex-none lg:justify-start">{weekNav}</div>
          <SaveIndicator state={saveState} savedAt={savedAt} />

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <button className="btn-outline" onClick={() => onDownload("share")} disabled={!card || !!busy}>
              <Share className="h-4 w-4" /> {busy === "share" ? "Preparing…" : "Send to mentor"}
            </button>
            <button className="btn-solid" onClick={() => onDownload("pdf")} disabled={!card || !!busy}>
              <Download className="h-4 w-4" /> {busy === "pdf" ? "Preparing…" : "Download PDF"}
            </button>
          </div>
          <InfoButton />
        </div>
        {progress && (
          <div className="h-[3px] bg-black/[0.05]" aria-hidden>
            <div className="h-full bg-brand transition-all duration-300" style={{ width: `${(progress.filled / progress.total) * 100}%` }} />
          </div>
        )}
      </div>

      {/* ───────── Messages ───────── */}
      {error && (
        <div className="screen-only mx-auto mt-3 max-w-[860px] px-3 lg:px-0">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        </div>
      )}

      {/* ───────── Card ───────── */}
      <div className="screen-only mt-3 flex-1 px-3 pb-28 lg:mt-5 lg:px-4 lg:pb-10">
        <div className="mx-auto max-w-[860px]">
          {loadError ? (
            <div className="w-full rounded-2xl border border-rose-200 bg-white p-6 text-center">
              <p className="mb-4 text-sm text-rose-700">{loadError}</p>
              <button className="btn-solid" onClick={() => setReload((n) => n + 1)}>
                Try again
              </button>
            </div>
          ) : card ? (
            <SadhanaCard card={card} mode="edit" onChange={onChange} onPickWeek={goToWeek} today={today} />
          ) : (
            <div className="space-y-4">
              <div className="h-32 animate-pulse rounded-3xl bg-white/70" />
              <div className="h-16 animate-pulse rounded-2xl bg-white/70" />
              <div className="h-96 animate-pulse rounded-2xl bg-white/70" />
            </div>
          )}
        </div>
      </div>

      {/* ───────── Phone bottom bar ───────── */}
      <div
        aria-hidden={typing || undefined}
        className={`screen-only fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.06] bg-white/95 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out lg:hidden ${
          typing ? "pointer-events-none translate-y-full" : ""
        }`}
      >
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-brand/30 bg-white font-semibold text-brand disabled:opacity-50"
            onClick={() => onDownload("pdf")}
            disabled={!card || !!busy}
          >
            <Download className="h-5 w-5" /> {busy === "pdf" ? "Preparing…" : "Download"}
          </button>
          <button
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand font-semibold whitespace-nowrap text-white shadow-sm disabled:opacity-50"
            onClick={() => onDownload("share")}
            disabled={!card || !!busy}
          >
            <Share className="h-5 w-5" /> {busy === "share" ? "Preparing…" : "Send to mentor"}
          </button>
        </div>
      </div>

      {card && <PrivacyNotice weekStart={card.weekStart} weekLabel={formatWeekRange(card.weekStart)} />}
      <ShareDialog file={share} text={shareText} onClose={() => setShare(null)} />

      {/* ───────── Static copy used for PDF / image / print ───────── */}
      {card && (
        <div className="export-host" aria-hidden inert>
          <SadhanaCard ref={exportRef} card={card} mode="export" />
        </div>
      )}
    </main>
  );
}

function SaveIndicator({ state, savedAt }: { state: SaveState; savedAt: string | null }) {
  const time = savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
  const label =
    state === "saving" || state === "dirty"
      ? "Saving…"
      : state === "error"
        ? "Not saved — check your connection"
        : state === "saved"
          ? `Saved${time ? ` at ${time}` : ""}`
          : "Saves automatically";
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center lg:w-auto lg:gap-1.5 lg:px-2" title={label} aria-live="polite" aria-label={label}>
      {state === "saving" || state === "dirty" ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
      ) : state === "error" ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[12px] font-bold text-white">!</span>
      ) : state === "saved" ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-3.5 w-3.5" />
        </span>
      ) : (
        <span className="h-2 w-2 rounded-full bg-ink/20" />
      )}
      <span className={`hidden text-xs lg:inline ${state === "error" ? "text-rose-600" : "text-ink/55"}`}>{label}</span>
    </span>
  );
}
