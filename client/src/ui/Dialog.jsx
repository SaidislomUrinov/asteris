import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { HiXMark } from "react-icons/hi2";
import { dialogClosed, dialogOpened } from "../utils/dialogState";

/**
 * Dialog — loyihaning yagona modal qobig'i.
 *
 * Dizayn: yumshoq (rounded-3xl) oq karta, sarlavha ortida brend rangidagi
 * mayin radial yorug'lik, chegara-chiziqsiz sarlavha bloki va suzuvchi
 * yopish tugmasi. Chegaralar o'rniga bo'shliq va rang ierarxiyani beradi.
 *
 * @param {string} [props.eyebrow] - Sarlavha tepasidagi mayda brend yorlig'i (ixtiyoriy)
 * @param {string} [props.description] - Sarlavha ostidagi izoh matni (ixtiyoriy)
 * @param {string} [props.widthClass] - md+ kenglik klassi (default `md:w-150`), masalan video uchun `md:w-215`
 */
function Dialog({
  children,
  open = false,
  onClose = () => {},
  title = "Dialog",
  eyebrow,
  description,
  className = "",
  actions,
  zIndex = "z-30",
  widthClass = "md:w-150",
}) {
  const { t } = useTranslation();
  // phase: "closed" -> hech narsa render qilinmaydi, "open" -> kirish animatsiyasi,
  // "closing" -> chiqish animatsiyasi (tugagach "closed"ga o'tadi)
  const [phase, setPhase] = useState(open ? "open" : "closed");
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    setPhase(open ? "open" : "closing");
  }

  // Ochiq modallar sonini global hisoblagichda yuritamiz — apparat QR skaner
  // modal ochiq turganda tinglashni to'xtatishi kerak (utils/dialogState.js).
  useEffect(() => {
    if (!open) return;
    dialogOpened();
    return dialogClosed;
  }, [open]);

  if (phase === "closed") return null;

  const closing = phase === "closing";

  return createPortal(
    <Fragment>
      <div
        className={`fixed w-full h-full inset-0 bg-black/50 backdrop-blur-sm ${zIndex} ${
          closing ? "animate-overlay-out" : "animate-overlay-in"
        }`}
      ></div>

      <div
        className={`fixed inset-0 flex items-center justify-center ${zIndex} p-4`}
      >
        <div
          className={`bg-white dark:bg-night-900 rounded-3xl shadow-[0_24px_60px_-12px_rgba(15,23,42,0.25)] dark:shadow-none w-full ${widthClass} relative isolate ${
            closing ? "animate-dialog-out" : "animate-dialog-in"
          } ${className}`}
          onClick={(e) => e.stopPropagation()}
          onAnimationEnd={() => closing && setPhase("closed")}
        >
          {/* Brend yorug'ligi — sarlavha ortida, o'ng yuqori burchakdan tarqaladi.
              `-z-10` tufayli kontentga to'sqinlik qilmaydi. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl"
          >
            <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          </div>

          {/* Sarlavha & yopish tugmasi */}
          <div className="flex justify-between items-start gap-4 px-6 pt-6 pb-4">
            <div className="flex flex-col gap-1.5 min-w-0">
              {eyebrow ? (
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600 dark:text-blue-400">
                  <span className="size-1.5 rounded-full bg-blue-500" />
                  {eyebrow}
                </span>
              ) : null}
              <h3 className="text-[24px] leading-tight text-slate-900 dark:text-slate-100 font-semibold tracking-tight">
                {title}
              </h3>
              {description ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {description}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="shrink-0 inline-flex items-center justify-center size-9 rounded-full bg-white/70 dark:bg-night-900/70 text-slate-400 dark:text-slate-500 backdrop-blur-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-night-800 hover:text-slate-700 dark:hover:text-slate-300 active:scale-95 duration-200"
            >
              <HiXMark className="text-[20px]" />
            </button>
          </div>

          {/* gap-4 — maydonlar endi o'z yorlig'i (va ba'zan izohi) bilan
              keladi, gap-2 da keyingi maydonning yorlig'i oldingisining
              tagiga yopishib qolardi. */}
          <div className="flex flex-col w-full px-6 pb-6 gap-4 max-h-[70vh] overflow-y-auto">
            {children}
          </div>
          {actions ? (
            <div className="flex items-center border-t border-slate-100 dark:border-night-700 py-3 justify-end w-full px-6 gap-2">
              {actions}
            </div>
          ) : (
            ""
          )}
        </div>
      </div>
    </Fragment>,
    document.body,
  );
}

export default Dialog;
