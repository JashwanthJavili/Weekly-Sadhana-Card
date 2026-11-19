"use client";

import { useId, useState } from "react";
import { Download, FileIcon, Share } from "@/components/icons";
import { DialogBadge, Modal } from "@/components/Modal";
import { canSharePdf, downloadBlob, sharePdfFile } from "@/lib/export";

/**
 * Step 2 of "Send to mentor": the PDF is ready; this tap opens the phone's share sheet
 * (WhatsApp, Telegram, email…). Where sharing files isn't supported (most desktops), it
 * downloads the PDF and opens WhatsApp with a ready-made message to attach it to.
 */
export function ShareDialog({ file, text, onClose }: { file: File | null; text: string; onClose: () => void }) {
  const id = useId();
  const [note, setNote] = useState<string | null>(null);
  const supported = !!file && canSharePdf(file);

  const close = () => {
    setNote(null);
    onClose();
  };

  const fallback = () => {
    if (!file) return;
    downloadBlob(file, file.name);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setNote("The PDF was downloaded. In WhatsApp, choose your mentor and attach the PDF.");
  };

  const doShare = async () => {
    if (!file) return;
    const r = await sharePdfFile(file, text);
    if (r === "shared") close();
    else if (r === "unsupported") fallback();
  };

  return (
    <Modal open={!!file} onClose={close} labelledBy={id}>
      <div className="text-center">
        <DialogBadge>
          <Share className="h-6 w-6" />
        </DialogBadge>
        <h2 id={id} className="mt-4 font-serif text-[22px] font-bold text-ink">
          Send to your mentor
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink/65">
          {supported ? "Your card is ready. Tap Send and choose WhatsApp (or any app), then pick your mentor." : "Your card is ready as a PDF."}
        </p>
      </div>

      {file && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-band p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand">
            <FileIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-[14px] font-semibold text-ink">{file.name}</span>
            <span className="block text-[12px] text-ink/55">PDF · {Math.max(1, Math.round(file.size / 1024))} KB</span>
          </span>
        </div>
      )}

      {note && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-center text-[13px] text-emerald-900 ring-1 ring-emerald-200">{note}</p>}

      {supported ? (
        <button
          type="button"
          onClick={() => void doShare()}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[15px] font-semibold text-white shadow-sm hover:bg-brand-dark"
        >
          <Share className="h-5 w-5" /> Send
        </button>
      ) : (
        <button
          type="button"
          onClick={fallback}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[15px] font-semibold text-white shadow-sm hover:brightness-95"
        >
          <Download className="h-5 w-5" /> Download &amp; open WhatsApp
        </button>
      )}
      <button type="button" onClick={close} className="mt-2 h-10 w-full text-sm font-medium text-ink/55">
        Done
      </button>
    </Modal>
  );
}
