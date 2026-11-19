"use client";

import { useEffect } from "react";

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
