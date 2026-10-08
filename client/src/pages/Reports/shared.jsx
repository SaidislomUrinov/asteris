import { useTranslation } from "react-i18next";
import { HiArrowSmallDown, HiArrowSmallUp, HiChartBar } from "react-icons/hi2";
import Button from "../../ui/Button";

// Hisobot tablarida takrorlanadigan UI bo'laklari. Ma'lumot olish/saralash
// hook'lari va formatlovchilar `reportData.js` da (fast-refresh qoidasi).

/**
 * Saralanadigan ustun sarlavhasi — `List` ustunining `header` maydoniga
 * beriladi.
 */
export function SortHeader({ label, sortKey, sort, onToggle }) {
  const active = sort?.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={`inline-flex items-center gap-1 cursor-pointer uppercase font-semibold duration-150 ${
        active ? "text-slate-700 dark:text-slate-300" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
      }`}
    >
      {label}
      {active &&
        (sort.dir === "asc" ? (
          <HiArrowSmallUp className="text-sm" />
        ) : (
          <HiArrowSmallDown className="text-sm" />
        ))}
    </button>
  );
}

/**
 * Davomat foizi ustuni. `ui/ProgressBar` bu yerga to'g'ri kelmaydi — u
 * `value/max` yorlig'i bilan ustun-ustun chiziladi va kenglik boshqaruvini
 * qabul qilmaydi; jadval katagida esa ixcham, bir qatorlik ko'rinish kerak.
 */
export function RateBar({ value = 0 }) {
  const v = Math.min(100, Math.max(0, Math.round(value || 0)));
  const tone = v >= 80 ? "bg-emerald-500" : v >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2 min-w-28">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-night-800 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{v}%</span>
    </div>
  );
}

export function ReportError({ onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center w-full flex-1 min-h-60 gap-3 text-slate-400 dark:text-slate-500">
      <HiChartBar className="text-4xl" />
      <p className="text-sm">{t("report.loadError")}</p>
      <Button variant="outlined" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
