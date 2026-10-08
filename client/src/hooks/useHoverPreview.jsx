import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PREVIEW_SIZE = 150;
const GAP = 12;
const EDGE = 8;
const OPEN_DELAY = 200;

/** Faqat sichqonchali desktop (sensorli telefon/planshetda preview yo'q). */
const canHoverPreview = () =>
  typeof window !== "undefined" &&
  window.innerWidth >= 640 &&
  !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

/** Avatar o'ng tomonida (joy bo'lmasa — chapda), vertikal markazda, viewport ichida. */
const computePosition = (rect) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.right + GAP;
  if (left + PREVIEW_SIZE > vw - EDGE) left = rect.left - GAP - PREVIEW_SIZE;
  left = Math.max(EDGE, Math.min(left, vw - PREVIEW_SIZE - EDGE));
  const center = rect.top + rect.height / 2 - PREVIEW_SIZE / 2;
  const top = Math.max(EDGE, Math.min(center, vh - PREVIEW_SIZE - EDGE));
  return { top, left };
};

/**
 * Desktop hover preview — avatar rasmini 150×150 kattaroq ko'rsatadi
 * (docs/API_CONTRACT_student_photo_everywhere.md §3).
 *
 * Yengil: har avatarda faqat mouseenter/mouseleave; scroll/resize/blur
 * tinglovchilari faqat preview ochiq bo'lganda qo'shiladi.
 *
 * @param {string} [src] - rasm URL (bo'sh bo'lsa preview yo'q)
 * @param {{enabled?: boolean, alt?: string}} [opts]
 * @returns {{ handlers: {onMouseEnter: Function, onMouseLeave: Function}, close: Function, element: React.ReactNode }}
 */
function useHoverPreview(src, { enabled = true, alt = "" } = {}) {
  const [pos, setPos] = useState(null);
  const timerRef = useRef(null);
  const active = enabled && !!src;

  // Kutayotgan timer o'chirilgan holatda (masalan menyu ochilgan) ochib yubormasin.
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const close = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    setPos(null);
  }, []);

  const onMouseEnter = useCallback(
    (e) => {
      if (!active || !canHoverPreview()) return;
      const target = e.currentTarget;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!activeRef.current || !target.isConnected) return;
        setPos(computePosition(target.getBoundingClientRect()));
      }, OPEN_DELAY);
    },
    [active],
  );

  // Unmount — kutayotgan timer tozalanadi.
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // O'chirilsa (enabled=false, rasm olib tashlandi) — darhol yashirinadi.
  const open = !!pos && active;

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [open, close]);

  const element = open
    ? createPortal(
        <div
          aria-hidden="true"
          style={{ top: pos.top, left: pos.left, width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
          className="fixed z-[60] pointer-events-none rounded-2xl p-1 bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.18)] dark:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.55)]"
        >
          <img src={src} alt={alt} draggable={false} className="w-full h-full object-cover rounded-xl bg-slate-100 dark:bg-night-800" />
        </div>,
        document.body,
      )
    : null;

  return { handlers: { onMouseEnter, onMouseLeave: close }, close, element };
}

export default useHoverPreview;
