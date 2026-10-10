import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";

/**
 * Kompakt oy tanlovi — "< Avgust 2026 >" bitta pill ichida. `month`/`onChange`
 * "YYYY-MM" formatida ishlaydi, `max`dan keyingi oyga o'tish bloklanadi.
 * `label` — chaqiruvchi tomondan `t("common.monthNames")` orqali tayyorlab
 * beriladi (brauzer Intl'iga emas, loyiha i18n'iga tayanish uchun).
 *
 * @param {Object} props
 * @param {string} props.month - "YYYY-MM"
 * @param {string} props.label - ko'rinadigan matn, masalan "Avgust 2026"
 * @param {(month: string) => void} props.onChange
 * @param {string} [props.max] - "YYYY-MM", shu oydan keyin "keyingi" bosilmaydi
 * @param {string} [props.min] - "YYYY-MM", shu oydan oldingi oyga "oldingi" bosilmaydi
 * @param {string} [props.className]
 */
function MonthNav({ month, label, onChange, max, min, className = "" }) {
  const monthOf = (str) => Number(str.slice(5, 7)) - 1;
  const yearOf = (str) => Number(str.slice(0, 4));
  const shift = (delta) => {
    const d = new Date(yearOf(month), monthOf(month) + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const disableNext = !!max && month >= max;
  const disablePrev = !!min && month <= min;

  return (
    <div className={`flex items-center gap-0.5 p-1 rounded-full bg-slate-50 dark:bg-night-800 ${className}`}>
      <button
        type="button"
        disabled={disablePrev}
        onClick={() => shift(-1)}
        className="flex items-center justify-center w-7 h-7 rounded-full text-slate-400 dark:text-slate-500 enabled:hover:bg-white dark:enabled:hover:bg-night-900 enabled:hover:text-slate-700 dark:enabled:hover:text-slate-300 enabled:hover:shadow-sm dark:enabled:hover:shadow-none enabled:cursor-pointer disabled:opacity-25 transition-all"
      >
        <HiChevronLeft className="text-sm" />
      </button>
      <span className="min-w-24 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">
        {label}
      </span>
      <button
        type="button"
        disabled={disableNext}
        onClick={() => shift(1)}
        className="flex items-center justify-center w-7 h-7 rounded-full text-slate-400 dark:text-slate-500 enabled:hover:bg-white dark:enabled:hover:bg-night-900 enabled:hover:text-slate-700 dark:enabled:hover:text-slate-300 enabled:hover:shadow-sm dark:enabled:hover:shadow-none enabled:cursor-pointer disabled:opacity-25 transition-all"
      >
        <HiChevronRight className="text-sm" />
      </button>
    </div>
  );
}

export default MonthNav;
