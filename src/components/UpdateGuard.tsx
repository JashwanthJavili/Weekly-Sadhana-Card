"use client";

import { useEffect, useState } from "react";

const KEY = "sadhana-card:reloaded-for-update";

/** True for the errors a browser throws when it still runs an older version of the app. */
export function isStaleVersionError(e: unknown): boolean {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e ?? "");
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Failed to fetch RSC payload/i.test(text);
}

/** Reload once to pick up the newest version (guards against reload loops). */
export function reloadForUpdate(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30_000) return false; // already tried just now
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage blocked: still try once */
  }
  window.location.reload();
  return true;
}

/* ───────── checking for a newer version ───────── */

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
let busy = false; // set by the card page while changes are being saved

/** The card page calls this while it has changes that aren't saved yet, so an update waits. */
export function setUpdateBlocked(blocked: boolean) {
  busy = blocked;
}

async function latestVersion(): Promise<string | null> {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { id?: string };
    return j.id ?? null;
  } catch {
    return null; // offline: try again later
  }
}

/** Is someone typing right now? Don't pull the page away from under them. */
const typing = () => {
  const a = document.activeElement;
  return a instanceof HTMLTextAreaElement || (a instanceof HTMLInputElement && a.type !== "button");
};

/**
 * After a new deploy, a page left open still references the old JavaScript files.
 * When it tries to load one that no longer exists, quietly reload to the new version.
 */
export function UpdateGuard() {
  // Check for a newer version: on opening, when the app comes back to the screen, and every 5 minutes.
  // If there is one, reload straight away (after any unsaved changes are saved).
  useEffect(() => {
    if (!CURRENT || process.env.NODE_ENV !== "production") return;
    let waiting: number | undefined;
    const tryUpdate = (target: string) => {
      window.clearTimeout(waiting);
      if (busy || typing()) {
        waiting = window.setTimeout(() => tryUpdate(target), 2000);
        return;
      }
      // Never loop: reload for a given version only once per tab.
      try {
        if (sessionStorage.getItem(KEY + ":" + target)) return;
        sessionStorage.setItem(KEY + ":" + target, "1");
      } catch {
        /* storage blocked: reload anyway */
      }
      window.location.reload();
    };
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const latest = await latestVersion();
      if (latest && latest !== CURRENT) tryUpdate(latest);
    };
    void check();
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    const timer = window.setInterval(check, 5 * 60 * 1000);
    return () => {
      window.clearTimeout(waiting);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, []);

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (isStaleVersionError(e.error ?? e.message)) reloadForUpdate();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleVersionError(e.reason)) reloadForUpdate();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}

/** A small strip at the top while the phone is offline: changes are kept and uploaded later. */
export function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[80] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pointer-events-none">
      <div className="rounded-full bg-ink/90 px-3.5 py-1.5 text-center text-[12px] font-medium text-white shadow-lg">
        You&apos;re offline. Your changes are kept on this phone.
      </div>
    </div>
  );
}
