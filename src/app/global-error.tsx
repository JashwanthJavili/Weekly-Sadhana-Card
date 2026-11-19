"use client";

import { useEffect } from "react";

/** Last-resort screen if the whole app shell fails (replaces the root layout). */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
    const stale = /ChunkLoadError|Loading chunk|dynamically imported module/i.test(`${error.name} ${error.message}`);
    try {
      const last = Number(sessionStorage.getItem("sadhana-card:reloaded-for-update") || 0);
      if (stale && Date.now() - last > 30_000) {
        sessionStorage.setItem("sadhana-card:reloaded-for-update", String(Date.now()));
        window.location.reload();
      }
    } catch {
      /* ignore */
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#eef3f1", margin: 0 }}>
        <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 24, padding: 24, maxWidth: 360, textAlign: "center" }}>
            <h1 style={{ fontSize: 22, margin: 0, color: "#434343" }}>Something went wrong</h1>
            <p style={{ color: "#6b6b6b", fontSize: 14 }}>Your cards are safe. Please reload the page.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ background: "#008080", color: "#fff", border: 0, borderRadius: 16, height: 44, padding: "0 24px", fontWeight: 600 }}
            >
              Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
