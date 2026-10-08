import { useTranslation } from "react-i18next";
import { WEEK_ORDER } from "./calendarUtils";

// Desktop oy jadvali (1-shablon): katakda darslar soni chiziq bilan, dam olish
// izohi katakning o'zida. Holat va amallar ota sahifada.
function MonthGrid({ cells, days, selected, todayKey, canManage, unmarking, maxLessons, onDayClick }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-7 gap-1.5 w-full">
      {WEEK_ORDER.map((d) => (
        <span
          key={d}
          className={`text-center text-[11px] font-bold uppercase py-1 tracking-wider ${
            d === "sun" ? "text-red-400" : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {t(`group.dayShort.${d}`)}
        </span>
      ))}

      {cells.map((cell, i) => {
        if (cell === null) return <span key={`b-${i}`} />;
        const info = days[cell.key];
        const holiday = info?.holiday || null;
        const lessonCount = info?.lessonCount ?? 0;
        const isSelected = selected.includes(cell.key);
        const isToday = cell.key === todayKey;
        const isSun = cell.weekdayCode === "sun";

        const tone = isSelected
          ? "bg-blue-500 border-blue-500 text-white shadow-sm shadow-blue-200"
          : holiday
            ? "border-slate-200 dark:border-night-700 bg-[repeating-linear-gradient(135deg,#f1f5f9_0_6px,#e9edf3_6px_12px)] dark:bg-[repeating-linear-gradient(135deg,#14223f_0_6px,#0d1830_6px_12px)]"
            : "border-slate-100 dark:border-night-700 bg-white dark:bg-night-900 hover:border-blue-200 dark:hover:border-blue-500/30";

        return (
          <button
            key={cell.key}
            type="button"
            onClick={(e) => onDayClick(cell.key, e, !!holiday)}
            disabled={!canManage || unmarking === cell.key}
            title={
              holiday
                ? `${t("calendar.holidayBadge")}${holiday.note ? ` — ${holiday.note}` : ""}${
                    canManage ? ` (${t("calendar.unmarkAction")})` : ""
                  }`
                : undefined
            }
            className={`flex flex-col justify-between h-21 p-2 rounded-xl border text-left transition-colors duration-150 ${tone} ${
              isToday && !isSelected ? "ring-2 ring-inset ring-blue-500" : ""
            } ${canManage ? "cursor-pointer" : "cursor-default"}`}
          >
            <span
              className={`font-space text-[15px] font-semibold tabular-nums ${
                isSelected
                  ? "text-white"
                  : holiday
                    ? "text-slate-400 dark:text-slate-500 line-through decoration-2 decoration-slate-300"
                    : isSun
                      ? "text-red-500"
                      : "text-slate-800 dark:text-slate-100"
              }`}
            >
              {cell.day}
            </span>

            {holiday ? (
              <span
                className={`text-[10.5px] font-bold leading-tight line-clamp-2 ${
                  isSelected ? "text-white" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {holiday.note || t("calendar.holidayBadge")}
              </span>
            ) : lessonCount > 0 ? (
              <span className="flex flex-col gap-1">
                <span className={`text-[11px] font-bold tabular-nums ${isSelected ? "text-white" : "text-slate-500 dark:text-slate-400"}`}>
                  {t("calendar.lessonsCount", { count: lessonCount })}
                </span>
                <span className={`h-1 rounded-full overflow-hidden ${isSelected ? "bg-white/30 dark:bg-night-900/30" : "bg-slate-100 dark:bg-night-800"}`}>
                  <span
                    className={`block h-full rounded-full ${isSelected ? "bg-white dark:bg-night-900" : "bg-blue-500"}`}
                    style={{ width: `${Math.max(8, (lessonCount / maxLessons) * 100)}%` }}
                  />
                </span>
              </span>
            ) : (
              <span className={`text-[11px] ${isSelected ? "text-white/80" : "text-slate-300 dark:text-slate-600"}`}>—</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default MonthGrid;
