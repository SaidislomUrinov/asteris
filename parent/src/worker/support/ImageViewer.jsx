import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HiXMark } from "react-icons/hi2";
import { setBackButton } from "../../lib/telegram";
import { useWorker } from "../useWorker";

// Chat rasmini to'liq ekranda ko'rish. Motion yo'q (loyiha qoidasi — faqat
// BottomSheet). Telegram BackButton ham yopadi, yopilgach sahifa amaliga qaytadi.
export const ImageViewer = ({ src, onClose }) => {
  const { t } = useTranslation();
  const { pageBackRef } = useWorker();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    setBackButton(true, onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const pageBack = pageBackRef?.current || null;
      setBackButton(!!pageBack, pageBack);
    };
  }, [onClose, pageBackRef]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] bg-black/90 grid place-items-center" onClick={onClose}>
      <img src={src} alt="" className="max-w-full max-h-full object-contain select-none" />
      <button
        type="button"
        onClick={onClose}
        aria-label={t("worker.support.closeImage")}
        className="absolute right-3 w-10 h-10 rounded-full bg-white/15 text-white grid place-items-center active:opacity-70"
        style={{ top: "calc(12px + env(safe-area-inset-top))" }}
      >
        <HiXMark className="w-6 h-6" />
      </button>
    </div>
  );
};
