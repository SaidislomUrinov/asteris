import { useEffect } from "react";
import { HiXMark } from "react-icons/hi2";
import { useTranslation } from "react-i18next";
import { setBackButton } from "../../lib/telegram";
import { cn } from "../../utils/cn";
import { useWorker } from "../useWorker";

// Pastki oyna — loyiha motion qoidasi: faqat dialog/sheet pastdan yuqoriga
// + fade (`animate-dialog-in`). Telegram BackButton ham oynani yopadi,
// yopilgach esa sahifaning o'z "orqaga" amaliga qaytadi (ichki sahifalarda
// tugma yo'qolib qolmasin).
export const BottomSheet = ({ open, onClose, title, subtitle, right, children, footer, busy, className }) => {
  const { t } = useTranslation();
  const { pageBackRef } = useWorker();

  useEffect(() => {
    if (!open) return undefined;
    const close = () => !busy && onClose();
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    setBackButton(true, close);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      // Ataylab YOPILISH paytidagi qiymat — sahifa almashgan bo'lsa yangisi.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const pageBack = pageBackRef?.current || null;
      setBackButton(!!pageBack, pageBack);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onClose, pageBackRef]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/45 animate-overlay-in" onClick={() => !busy && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full max-w-lg bg-card text-ink rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.2)] animate-dialog-in flex flex-col max-h-[88dvh]",
          className,
        )}
      >
        <div className="pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-line mx-auto" />
        </div>
        <header className="flex items-start justify-between gap-3 px-4 pb-2 shrink-0">
          <div className="min-w-0">
            <div className="font-title text-lg font-bold leading-tight break-words">{title}</div>
            {subtitle && <div className="text-[13px] text-hint mt-0.5 break-words">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {right}
            <button
              type="button"
              onClick={() => !busy && onClose()}
              aria-label={t("common.cancel")}
              className="w-8 h-8 -mr-1 rounded-full bg-ink/6 grid place-items-center text-hint"
            >
              <HiXMark className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="px-4 pb-3 overflow-y-auto overscroll-contain flex flex-col gap-2.5 min-h-0">{children}</div>
        {footer && (
          <div className="px-4 pt-2 shrink-0 border-t border-line/60" style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}>
            {footer}
          </div>
        )}
        {!footer && <div className="shrink-0" style={{ height: "env(safe-area-inset-bottom)" }} />}
      </div>
    </div>
  );
};
