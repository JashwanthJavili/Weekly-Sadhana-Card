"use client";

import { useEffect, useState } from "react";

/**
 * Height (px) of the on-screen keyboard, or 0 when it is closed.
 * Uses the visual viewport, so bottom sheets can sit right on top of the keyboard
 * instead of being pushed around by the browser.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!enabled || !vv) {
      setInset(0);
      return;
    }
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Pinch-zoom also shrinks the visual viewport; that is not a keyboard.
        if (Math.abs(vv.scale - 1) > 0.01) return setInset(0);
        const layoutH = document.documentElement.clientHeight;
        const gap = layoutH - (vv.height + vv.offsetTop);
        setInset(gap > 120 ? Math.round(gap) : 0);
      });
    };
    measure();
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
    };
  }, [enabled]);

  return inset;
}

/** True while a text box has focus on a touch device (keyboard is, or is about to be, on screen). */
export function useTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const isText = (el: EventTarget | null) =>
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && !["button", "checkbox", "radio", "range", "submit", "date"].includes(el.type));
    const onIn = (e: FocusEvent) => isText(e.target) && setTyping(true);
    const onOut = (e: FocusEvent) => {
      if (isText(e.target) && !isText(e.relatedTarget)) setTyping(false);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return typing;
}
