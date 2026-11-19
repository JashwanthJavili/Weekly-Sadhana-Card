"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseFab } from "@/components/pickers";
import { useKeyboardInset } from "@/lib/useKeyboard";

/**
 * Centered dialog on desktop, bottom sheet on phones, 75% black backdrop.
 * Without `onClose` it can't be dismissed (used for "unlock your cards").
 */
export function Modal(props: { open: boolean; onClose?: () => void; labelledBy?: string; children: ReactNode; z?: string }) {
  const { open, onClose, labelledBy, children, z = "z-[70]" } = props;
  const keyboard = useKeyboardInset(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={`modal-backdrop fixed inset-0 ${z} flex items-end justify-center bg-black/75 sm:items-center sm:p-4`}
      style={{ paddingBottom: keyboard, transition: "padding-bottom 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
      onClick={onClose}
    >
      <div className="modal-panel relative w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        {onClose && <CloseFab onClick={onClose} />}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className="relative max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pb-6"
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Round gradient badge used at the top of dialogs. */
export function DialogBadge({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "danger" }) {
  return (
    <div
      className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg ${
        tone === "danger" ? "bg-gradient-to-br from-rose-500 to-rose-400 shadow-rose-500/30" : "bg-gradient-to-br from-brand to-[#14a3a3] shadow-brand/30"
      }`}
    >
      {children}
    </div>
  );
}

/** Password box with a show/hide toggle. */
export function PassphraseInput(props: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoFocus?: boolean;
  autoComplete?: "new-password" | "current-password";
  onEnter?: () => void;
}) {
  const { value, onChange, label, autoFocus, autoComplete = "current-password", onEnter } = props;
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-left text-xs font-medium text-ink/60">
        {label}
      </label>
      <div className="flex items-center rounded-xl border border-line bg-paper focus-within:border-brand">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[16px] text-ink outline-none"
        />
        <button type="button" onClick={() => setShow((s) => !s)} className="px-3 text-xs font-semibold text-brand" aria-label={show ? "Hide card password" : "Show card password"}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

/** Simple confirm dialog (replaces window.confirm). */
export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  icon: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { open, title, message, confirmLabel, danger, busy, icon, onConfirm, onCancel } = props;
  const id = useId();
  return (
    <Modal open={open} onClose={busy ? undefined : onCancel} labelledBy={id}>
      <div className="text-center">
        <DialogBadge tone={danger ? "danger" : "brand"}>{icon}</DialogBadge>
        <h2 id={id} className="mt-4 font-serif text-[22px] font-bold text-ink">
          {title}
        </h2>
        <div className="mt-2 text-[14px] leading-relaxed text-ink/65">{message}</div>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onCancel} disabled={busy} className="h-12 rounded-2xl border border-line bg-white font-semibold text-ink disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`h-12 rounded-2xl font-semibold text-white disabled:opacity-60 ${danger ? "bg-rose-500 hover:bg-rose-600" : "bg-brand hover:bg-brand-dark"}`}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
