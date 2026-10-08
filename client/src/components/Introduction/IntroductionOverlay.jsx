import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBookOpen, HiChatBubbleLeftRight, HiPlayCircle, HiQuestionMarkCircle } from "react-icons/hi2";
import Button from "../../ui/Button";

const MAX_TOOLTIP_WIDTH = 384; // px — w-96 (kattaroq, o'qishga qulay)
// Telefonda (390px) 384px sig'maydi — chetlardan 12px qoldiriladi.
const tooltipWidth = () => Math.min(MAX_TOOLTIP_WIDTH, window.innerWidth - 24);
const GAP = 16; // nishon va tooltip orasidagi masofa

// Nishon rect'idan tooltipning eng mos joyini hisoblaydi (pastda, joy
// yetmasa yuqorida) va viewport ichida qolishi uchun x bo'yicha clamp qiladi.
// Navbar kabi ekran bo'yi to'liq balandlikdagi (tor va uzun) nishonlar uchun
// yuqori/pastda joy umuman qolmaydi — bunda tooltip nishonning YON tomoniga
// qo'yiladi.
const computeTooltipPos = (rect, TOOLTIP_WIDTH) => {
  const isTallNarrow = rect.height > window.innerHeight * 0.6;

  if (isTallNarrow) {
    const placeRight = rect.right + GAP + TOOLTIP_WIDTH <= window.innerWidth;
    const left = placeRight ? rect.right + GAP : Math.max(rect.left - GAP - TOOLTIP_WIDTH, 12);
    const top = Math.min(
      Math.max(rect.top + rect.height / 2 - 100, 12),
      window.innerHeight - 200,
    );
    return { top, bottom: undefined, left, placeBelow: true, sideY: top + 50 };
  }

  const spaceBelow = window.innerHeight - rect.bottom;
  const placeBelow = spaceBelow > 200 || spaceBelow > rect.top;

  const top = placeBelow ? rect.bottom + GAP : undefined;
  const bottom = placeBelow ? undefined : window.innerHeight - rect.top + GAP;

  let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
  left = Math.min(Math.max(left, 12), window.innerWidth - TOOLTIP_WIDTH - 12);

  return { top, bottom, left, placeBelow };
};

/**
 * Spotlight + tooltip + connector line — DOM'dagi `data-intro="..."`
 * atributiga qarab nishonni topadi (Button/Modal haqida import orqali
 * bilmaydi — faqat CSS selector orqali bog'lanadi).
 *
 * @param {Object} props
 * @param {{ id: string, target: () => string, titleKey: string, descriptionKey: string }} props.step
 * @param {number} props.index
 * @param {number} props.total
 * @param {boolean} props.isFirst
 * @param {boolean} props.isLast
 * @param {() => void} props.onNext
 * @param {() => void} props.onBack
 */
function IntroductionOverlay({ step, index, total, isFirst, isLast, onNext, onBack }) {
  const { t } = useTranslation();
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const recompute = () => {
      const el = document.querySelector(step.target());
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        bottom: r.bottom,
        right: r.right,
      });
    };

    recompute();
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [step]);

  if (!rect) return null;

  const isCircular = Math.abs(rect.width - rect.height) < 4;
  const TOOLTIP_WIDTH = tooltipWidth();
  const tooltip = computeTooltipPos(rect, TOOLTIP_WIDTH);

  const targetCenterX = rect.left + rect.width / 2;
  const targetCenterY = rect.top + rect.height / 2;
  const tooltipCenterX = tooltip.left + TOOLTIP_WIDTH / 2;
  const tooltipCenterY =
    tooltip.sideY !== undefined
      ? tooltip.sideY
      : tooltip.placeBelow
        ? rect.bottom + GAP - 8
        : window.innerHeight - tooltip.bottom + 8;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Spotlight teshik — atrofi katta box-shadow bilan qoraytiriladi */}
      <div
        className="fixed pointer-events-none transition-all duration-300"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          borderRadius: isCircular ? 9999 : 12,
          boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.75)",
        }}
      />

      {/* Connector chiziq — tooltip va nishon markazi orasida */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none">
        <line
          x1={targetCenterX}
          y1={targetCenterY}
          x2={tooltipCenterX}
          y2={tooltipCenterY}
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      </svg>

      {/* Tooltip kartochka */}
      <div
        className="fixed bg-white dark:bg-night-900 rounded-2xl shadow-xl dark:shadow-none p-6 flex flex-col gap-3 transition-all duration-300"
        style={{ top: tooltip.top, bottom: tooltip.bottom, left: tooltip.left, width: TOOLTIP_WIDTH }}
      >
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t(step.titleKey)}</p>
        <p className="text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed">{t(step.descriptionKey)}</p>
        {step.preview && <HelpMenuPreview active={step.preview} />}
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-slate-400 dark:text-slate-500 tabular-nums">
            {index + 1}/{total}
          </span>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button color="slate" variant="outlined" onClick={onBack}>
                {t("introduction.back")}
              </Button>
            )}
            <Button color="violet" onClick={onNext}>
              {isLast ? t("introduction.done") : t("introduction.next")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// "?" menyusining kichik namunasi (components/HelpMenu.jsx bilan bir xil
// bandlar, ikonka va ranglar) — shu bosqichga tegishli band ajratiladi.
const PREVIEW_ITEMS = [
  { key: "guide", icon: HiBookOpen, labelKey: "help.guide", iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { key: "video", icon: HiPlayCircle, labelKey: "help.video", iconClass: "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  { key: "chat", icon: HiChatBubbleLeftRight, labelKey: "help.chat", iconClass: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
];

function HelpMenuPreview({ active }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-night-800 border border-slate-100 dark:border-night-700" aria-hidden="true">
      <span className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        <HiQuestionMarkCircle className="text-sm" />
        {t("help.title")}
      </span>
      {PREVIEW_ITEMS.map((item) => {
        const on = item.key === active;
        return (
          <div
            key={item.key}
            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm ${
              on
                ? "bg-white dark:bg-night-900 ring-2 ring-violet-500 text-slate-800 dark:text-slate-100 font-semibold"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${on ? item.iconClass : "bg-slate-100 dark:bg-night-700"}`}>
              <item.icon className="text-base" />
            </span>
            {t(item.labelKey)}
          </div>
        );
      })}
    </div>
  );
}

export default IntroductionOverlay;
