"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- plain links on purpose: Next client navigation in a static export can open the raw .txt payload after a deploy */

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Home, Share } from "@/components/icons";
import { SadhanaCard } from "@/components/SadhanaCard";
import { WeekReport } from "@/components/WeekReport";
import { InfoButton, PrivacyNotice, UnlockNote } from "@/components/ui";
import { blankCard, cardHref, cardProgress, isCardEmpty, mergeProfile, cardFileName, shareMessage } from "@/lib/card";
import { formatWeekRange, parseISODate, shiftWeek, todayISO, weekStartISO } from "@/lib/dates";
import { buildCardImage, downloadBlob, shareFile } from "@/lib/export";
import { initAccount, LockedError } from "@/lib/account";
import { useAccount } from "@/components/AccountProvider";
import { ShareDialog } from "@/components/ShareDialog";
import { repo } from "@/lib/storage";
import { useTyping } from "@/lib/useKeyboard";
import { useUnlock } from "@/lib/useUnlock";
import type { WeekCard } from "@/lib/types";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "offline" | "error";

const AUTOSAVE_MS = 700;

/** "16 – 22 Nov" (or "27 Oct – 2 Nov"): fits narrow phones. */
function shortWeekRange(weekStart: string): string {
  const a = parseISODate(weekStart);
  if (!a) return weekStart;
  const b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 6);
  const m = (d: Date) => d.toLocaleString("en-GB", { month: "short" });
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${m(b)}` : `${a.getDate()} ${m(a)} – ${b.getDate()} ${m(b)}`;
}

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
  const [busy, setBusy] = useState<null | "download" | "share">(null);
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
  const unlock = useUnlock(weekStart); // download / send open on the Monday after the week
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
        console.error(e);
        setLoadError("Sorry, this card couldn't be opened. Please check your internet connection and try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [week, weekStart, reload, accountReady, acc.phase, acc.error, acc.version]);

  useEffect(() => {
    const onOnline = () => setSaveState((s) => (s === "offline" ? "saved" : s));
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

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
        console.error(e);
        setError("Sorry, your changes couldn't be saved. Please check your internet connection and try again.");
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
      setSaveState(navigator.onLine === false ? "offline" : "saved");
      setError(null);
    } catch (e) {
      setSaveState("error");
      console.error(e);
        setError("Sorry, your changes couldn't be saved. Please check your internet connection and try again.");
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

  const download = async () => {
    if (!card || !exportRef.current) return;
    setBusy("download");
    setError(null);
    try {
      // Save in the background — the download must not wait for the network.
      if (dirtyRef.current || !persistedRef.current) void persist(card);
      const file = await buildCardImage(exportRef.current, cardFileName(card));
      downloadBlob(file, file.name);
    } catch (e) {
      console.error(e);
      setError("Sorry, the download didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const shareText = card
    ? shareMessage(card)
    : "";

  /** Step 1 of "Send to mentor": make the file (phones need a fresh tap to share, see step 2). */
  const prepareShare = async () => {
    if (!card || !exportRef.current) return;
    setBusy("share");
    setError(null);
    try {
      if (dirtyRef.current || !persistedRef.current) void persist(card);
      const file = await buildCardImage(exportRef.current, cardFileName(card));
      // Straight to the share menu (WhatsApp…) with the image attached; the "Send" screen is only a fallback.
      const r = await shareFile(file, shareText);
      if (r === "needs-tap" || r === "unsupported") setShare(file);
    } catch (e) {
      console.error(e);
      setError("Sorry, your card couldn't be prepared. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  /* ───────── invalid URL ───────── */
  if (!weekStart) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="mb-4">Sorry, that date isn&apos;t valid. Please choose a week from your cards.</p>
        <a href="/" className="font-semibold text-brand underline">
          Back to my cards
        </a>
      </main>
    );
  }

  const progress = card ? cardProgress(card) : null;


  const weekNav = (
    <div className="flex min-w-0 items-center">
      <button className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-ink/70 hover:bg-band sm:w-9" onClick={() => goToWeek(shiftWeek(weekStart, -1))} aria-label="Previous week">
        <ChevronLeft />
      </button>
      <label className="relative min-w-0 cursor-pointer truncate rounded-lg px-1 py-1 text-[clamp(13px,4.2vw,15px)] font-semibold text-ink hover:bg-band">
        <span className="sm:hidden">{shortWeekRange(weekStart)}</span>
        <span className="hidden sm:inline">{formatWeekRange(weekStart)}</span>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => e.target.value && goToWeek(e.target.value)}
          aria-label="Pick a date to open its week"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <button className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-ink/70 hover:bg-band sm:w-9" onClick={() => goToWeek(shiftWeek(weekStart, 1))} aria-label="Next week">
        <ChevronRight />
      </button>
    </div>
  );

  return (
    <main className="page-in flex min-h-dvh flex-col">
      {/* ───────── Top bar ───────── */}
      <div className="sticky top-0 z-20 border-b border-black/[0.06] bg-white">
        <div className="mx-auto flex h-14 max-w-[900px] items-center gap-0.5 px-1.5 sm:gap-1 sm:px-2 lg:px-4">
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
          <div className="flex min-w-0 flex-1 justify-center lg:flex-none lg:justify-start">{weekNav}</div>
          <SaveIndicator state={saveState} savedAt={savedAt} />

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            {!unlock.open && unlock.left && weekStart && <UnlockNote weekStart={weekStart} day={unlock.day} left={unlock.left} layout="inline" />}
            <button type="button" onClick={() => void prepareShare()} disabled={!card || !!busy || !unlock.open} className="btn-outline">
              <Share className="h-4 w-4" /> {busy === "share" ? "Preparing…" : "Send to mentor"}
            </button>
            <button type="button" onClick={() => void download()} disabled={!card || !!busy || !unlock.open} className="btn-solid">
              <Download className="h-4 w-4" /> {busy === "download" ? "Preparing…" : "Download"}
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
        <div className="mx-auto mt-3 max-w-[860px] px-3 lg:px-0">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        </div>
      )}

      {/* ───────── Card ───────── */}
      <div className="mt-3 flex-1 px-3 pb-36 lg:mt-5 lg:px-4 lg:pb-10">
        <div className="mx-auto max-w-[860px]">
          {loadError ? (
            <div className="w-full rounded-2xl border border-rose-200 bg-white p-6 text-center">
              <p className="mb-4 text-sm text-rose-700">{loadError}</p>
              <button
                className="btn-solid"
                onClick={() => {
                  if (acc.phase === "error") void initAccount(); // reconnect, then the card loads by itself
                  else setReload((n) => n + 1);
                }}
              >
                Try again
              </button>
            </div>
          ) : card ? (
            <SadhanaCard card={card} onChange={onChange} onPickWeek={goToWeek} today={today} />
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
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.06] bg-white/95 px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out lg:hidden ${
          typing ? "pointer-events-none translate-y-full" : ""
        }`}
      >
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button type="button" onClick={() => void download()}
            disabled={!card || !!busy || !unlock.open}
            className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-brand/30 bg-white px-2 text-[clamp(13px,4vw,15px)] font-semibold whitespace-nowrap text-brand active:bg-band disabled:border-line disabled:text-ink/35"
          >
            <Download className="h-5 w-5" /> {busy === "download" ? "Preparing…" : "Download"}
          </button>
          <button type="button" onClick={() => void prepareShare()}
            disabled={!card || !!busy || !unlock.open}
            className="flex h-11 min-w-0 flex-[1.25] items-center justify-center gap-1.5 rounded-2xl bg-brand px-2 text-[clamp(13px,4vw,15px)] font-semibold whitespace-nowrap text-white shadow-sm active:bg-brand-dark disabled:bg-brand/35"
          >
            <Share className="h-5 w-5" /> {busy === "share" ? "Preparing…" : "Send to mentor"}
          </button>
        </div>
        {!unlock.open && unlock.left && weekStart && <UnlockNote weekStart={weekStart} day={unlock.day} left={unlock.left} layout="bar" />}
      </div>

      {card && <PrivacyNotice weekStart={card.weekStart} weekLabel={formatWeekRange(card.weekStart)} />}
      <ShareDialog file={share} text={shareText} onClose={() => setShare(null)} />

      {/* ───────── Off-screen report used to make the image ───────── */}
      {card && (
        <div className="export-host" aria-hidden inert>
          <WeekReport ref={exportRef} card={card} />
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
        ? "Not saved yet. Please check your internet connection."
        : state === "offline"
          ? "Saved on this phone. It will upload when you're back online."
          : state === "saved"
            ? `Saved${time ? ` at ${time}` : ""}`
          : "Saves automatically";
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center lg:w-auto lg:gap-1.5 lg:px-2" title={label} aria-live="polite" aria-label={label}>
      {state === "saving" || state === "dirty" ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
      ) : state === "error" ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[12px] font-bold text-white">!</span>
      ) : state === "offline" ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white">
          <Check className="h-3.5 w-3.5" />
        </span>
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
