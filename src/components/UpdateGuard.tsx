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

/**
 * After a new deploy, a page left open still references the old JavaScript files.
 * When it tries to load one that no longer exists, quietly reload to the new version.
 */
export function UpdateGuard() {
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
