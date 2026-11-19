"use client";

import { useId, useState } from "react";
import { FileIcon, ImageIcon, Share } from "@/components/icons";
import { DialogBadge, Modal } from "@/components/Modal";
import { canSharePdf, downloadBlob, sharePdfFile } from "@/lib/export";

/** The mentor everyone sends their card to (WhatsApp). */
export const MENTOR_WHATSAPP = "919963828877";
export const MENTOR_WHATSAPP_LABEL = "+91 99638 28877";

const ChatIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);

/**
 * Step 2 of "Send to mentor": the file is ready.
 * - "Send on WhatsApp": saves the file to the phone and opens the chat with the mentor's number,
 *   ready to attach it (WhatsApp can't receive a file for a specific number directly from a website).
 * - "Share with another app": the phone's share sheet with the file already attached.
 */
export function ShareDialog({ file, text, onClose }: { file: File | null; text: string; onClose: () => void }) {
  const id = useId();
  const [note, setNote] = useState<string | null>(null);
  const canShare = !!file && canSharePdf(file);
  const isImage = !!file?.type.startsWith("image/");
  const what = isImage ? "image" : "PDF";

  const close = () => {
    setNote(null);
    onClose();
  };

  const sendOnWhatsApp = () => {
    if (!file) return;
    downloadBlob(file, file.name);
    window.open(`https://wa.me/${MENTOR_WHATSAPP}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setNote(`Your card ${what} is saved on this phone. In the WhatsApp chat, tap the 📎 (attach) button and choose it.`);
  };

  const shareOther = async () => {
    if (!file) return;
    const r = await sharePdfFile(file, text);
    if (r === "shared") close();
    else if (r === "unsupported") sendOnWhatsApp();
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
          Your card is ready. It will be sent on WhatsApp to <b className="whitespace-nowrap text-ink">{MENTOR_WHATSAPP_LABEL}</b>.
        </p>
      </div>

      {file && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-band p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand">
            {isImage ? <ImageIcon className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-[14px] font-semibold text-ink">{file.name}</span>
            <span className="block text-[12px] text-ink/55">
              {isImage ? "Image" : "PDF"} · {Math.max(1, Math.round(file.size / 1024))} KB
            </span>
          </span>
        </div>
      )}

      {note && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-center text-[13px] leading-snug text-emerald-900 ring-1 ring-emerald-200">{note}</p>}

      <button
        type="button"
        onClick={sendOnWhatsApp}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[15px] font-semibold text-white shadow-sm hover:brightness-95"
      >
        <ChatIcon /> Send on WhatsApp
      </button>
      {canShare && (
        <button
          type="button"
          onClick={() => void shareOther()}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white text-[14px] font-semibold text-ink/75"
        >
          <Share className="h-4 w-4" /> Share with another app
        </button>
      )}
      <button type="button" onClick={close} className="mt-1 h-10 w-full text-sm font-medium text-ink/55">
        Done
      </button>
    </Modal>
  );
}
