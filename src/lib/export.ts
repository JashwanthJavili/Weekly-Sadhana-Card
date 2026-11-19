// Client-only helpers that turn the weekly report into a sharp PNG image to download or share.
// The renderer is imported lazily so it doesn't bloat the initial page load.

async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(imgs.map((img) => (img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => undefined))));
  if (document.fonts?.ready) await document.fonts.ready;
}

/**
 * The card as a crisp PNG. PNG keeps text perfectly sharp (no blur around letters), and it is
 * rendered at 3× (about 2460 px wide) so it stays clear when zoomed in or sent as an HD photo.
 */
export async function buildCardImage(node: HTMLElement, baseName: string): Promise<File> {
  const { toBlob } = await import("html-to-image");
  await waitForImages(node);
  const opts = { pixelRatio: 3, backgroundColor: "#ffffff", cacheBust: true };
  // First call warms up font/image embedding (some browsers miss them on the first pass).
  await toBlob(node, opts).catch(() => undefined);
  const blob = await toBlob(node, opts);
  if (!blob) throw new Error("Could not create the image.");
  return new File([blob], `${baseName}.png`, { type: "image/png" });
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Can this browser share a file through the system share menu (WhatsApp, etc.)? */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Open the phone's share menu with the file attached.
 * "needs-tap": the browser wants a fresh tap first (making the file took too long), so the caller
 * shows a one-button "Send" screen instead.
 */
export async function shareFile(file: File, text: string): Promise<"shared" | "cancelled" | "needs-tap" | "unsupported"> {
  if (!canShareFile(file)) return "unsupported";
  try {
    await navigator.share({ files: [file], title: "Sadhana Card", text });
    return "shared";
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "AbortError") return "cancelled";
    if (name === "NotAllowedError") return "needs-tap";
    return "unsupported";
  }
}
