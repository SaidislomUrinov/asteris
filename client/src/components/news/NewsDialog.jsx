import { useEffect, useRef } from "react";
import Dialog from "../../ui/Dialog";
import NewsViewer from "./NewsViewer";
import { isCritical } from "./newsUtils";

// "Juda muhim" — kartaning yuqori chetida qizil aksent chiziq (§6).
// `ui/Dialog` kartasi `relative` — pseudo-element shu kartaga yopishadi.
const CRITICAL_ACCENT =
  "before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:rounded-t-3xl before:bg-red-500";

/**
 * Yangilik oynasi — `ui/Dialog` ustidagi yupqa qatlam (motion faqat o'sha
 * yerda). `ui/Dialog` o'zi faqat X tugmasi bilan yopiladi: ESC va tashqariga
 * bosishni u tinglamaydi, `ui/` esa umumiy komponent — o'zgartirilmaydi.
 * Shu sabab ikkalasi shu yerda qo'shiladi va X bilan bir xil `onClose`ga
 * tushadi (popup'da bu "joriy yangilik o'qildi" degani).
 *
 * @param {Object} props.news - ko'rsatiladigan yangilik (yopilish animatsiyasida
 *   ham null bo'lmasligi uchun chaqiruvchi `useClosingValue` bilan ushlaydi)
 * @param {React.ReactNode} [props.footer] - pastki qotgan qator (popup navigatsiyasi)
 */
function NewsDialog({ open, news, onClose, footer, onInternalNavigate }) {
  const bodyRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current?.();
      }
    };
    // Backdrop: `ui/Dialog`da karta `fixed inset-0 flex` konteynerining
    // bevosita farzandi — konteynerning o'ziga (karta tashqarisiga) bosilsa,
    // `target` aynan shu konteyner bo'ladi.
    const onPointer = (e) => {
      const card = bodyRef.current?.closest(".rounded-3xl");
      if (card && e.target === card.parentElement) onCloseRef.current?.();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={news?.title || ""}
      className={isCritical(news) ? CRITICAL_ACCENT : ""}
      actions={footer}
    >
      <div ref={bodyRef}>
        <NewsViewer news={news} onInternalNavigate={onInternalNavigate} />
      </div>
    </Dialog>
  );
}

export default NewsDialog;
