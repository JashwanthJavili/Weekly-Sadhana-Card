// Client-only helpers that turn the rendered card into PNG / PDF downloads.
// Libraries are imported lazily so they don't bloat the initial page load.

const PAPER = "#fffdf4";

async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => (img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => undefined))),
  );
  if (document.fonts?.ready) await document.fonts.ready;
}

export async function renderCardPng(node: HTMLElement): Promise<string> {
  const { toPng } = await import("html-to-image");
  await waitForImages(node);
  const opts = { pixelRatio: 2, backgroundColor: PAPER, cacheBust: true };
  // First call warms up font/image embedding (some browsers miss them on the first pass).
  await toPng(node, opts).catch(() => undefined);
  return toPng(node, opts);
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadCardPng(node: HTMLElement, filename: string) {
  triggerDownload(await renderCardPng(node), filename);
}

function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** JPEG render used inside the PDF: a fraction of the size of a PNG at the same sharpness. */
export async function renderCardJpeg(node: HTMLElement): Promise<string> {
  const { toJpeg } = await import("html-to-image");
  await waitForImages(node);
  const opts = { pixelRatio: 2, quality: 0.85, backgroundColor: PAPER, cacheBust: true };
  await toJpeg(node, opts).catch(() => undefined); // warm-up pass (fonts/images)
  return toJpeg(node, opts);
}

/** The card as a one-page A4 PDF (typically well under 1 MB). */
export async function buildCardPdf(node: HTMLElement): Promise<Blob> {
  const dataUrl = await renderCardJpeg(node);
  const [{ jsPDF }, { w, h }] = await Promise.all([import("jspdf"), imageSize(dataUrl)]);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Always one page: scale the whole card to fit A4, centred.
  const scale = Math.min(pageW / w, pageH / h);
  const dw = w * scale;
  const dh = h * scale;
  pdf.setFillColor(PAPER);
  pdf.rect(0, 0, pageW, pageH, "F");
  pdf.addImage(dataUrl, "JPEG", (pageW - dw) / 2, (pageH - dh) / 2, dw, dh, undefined, "FAST");
  return pdf.output("blob");
}

export type CardFormat = "pdf" | "image";

/** The card as a ready-to-send file: a one-page PDF, or a JPEG picture (small, opens anywhere). */
export async function buildCardFile(node: HTMLElement, format: CardFormat, baseName: string): Promise<File> {
  if (format === "pdf") return new File([await buildCardPdf(node)], `${baseName}.pdf`, { type: "application/pdf" });
  const blob = await (await fetch(await renderCardJpeg(node))).blob();
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

export async function downloadCardPdf(node: HTMLElement, filename: string) {
  downloadBlob(await buildCardPdf(node), filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Can this browser share a PDF file through the system share sheet (WhatsApp, etc.)? */
export function canSharePdf(file: File): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Must be called straight from a tap (browsers require a fresh user gesture for sharing).
 * Returns "shared", "cancelled", or "unsupported".
 */
export async function sharePdfFile(file: File, text: string): Promise<"shared" | "cancelled" | "unsupported"> {
  if (!canSharePdf(file)) return "unsupported";
  try {
    await navigator.share({ files: [file], title: "Sadhana Card", text });
    return "shared";
  } catch (e) {
    return (e as { name?: string }).name === "AbortError" ? "cancelled" : "unsupported";
  }
}
