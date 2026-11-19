"use client";

import { useEffect } from "react";
import { isStaleVersionError, reloadForUpdate } from "@/components/UpdateGuard";

/** Friendly screen instead of "Application error" if a page crashes. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleVersionError(error);

  useEffect(() => {
    console.error(error);
    if (stale) reloadForUpdate();
  }, [error, stale]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
        <h1 className="font-serif text-[22px] font-bold text-ink">{stale ? "Updating…" : "Sorry, something went wrong"}</h1>
        <p className="mt-2 text-[14px] text-ink/65">
          {stale ? "A newer version of the app is available. Loading it now…" : "Your cards are safe. Please reload the page and try again."}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => reset()} className="h-11 rounded-2xl border border-line bg-white font-semibold text-ink">
            Try again
          </button>
          <button type="button" onClick={() => window.location.reload()} className="h-11 rounded-2xl bg-brand font-semibold text-white">
            Reload
          </button>
        </div>
      </div>
    </main>
  );
}
