import { HiEyeSlash } from "react-icons/hi2";
import { useTranslation } from "react-i18next";

/**
 * Grafik/donut kabi vizual moliyaviy bloklar o'rnini bosadi — CSS blur
 * emas, chunki blur qilingan taqdirda ham asl piksellar DOM'da qoladi va
 * ba'zi holatlarda o'qilishi mumkin. Bu yerda haqiqiy komponent umuman
 * render QILINMAYDI (real son ekranga chizilmaydi ham).
 */
function HiddenFinancePanel({ className = "" }) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-slate-200 dark:border-night-700 bg-slate-50/60 dark:bg-night-800/60 h-full min-h-40 text-slate-300 dark:text-slate-600 ${className}`}
    >
      <HiEyeSlash className="text-2xl" />
      <span className="text-sm font-bold tracking-[0.3em]">****</span>
      <span className="text-xs text-slate-400 dark:text-slate-500">{t("common.financeHidden")}</span>
    </div>
  );
}

export default HiddenFinancePanel;
