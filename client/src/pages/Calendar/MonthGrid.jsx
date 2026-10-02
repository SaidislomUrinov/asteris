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
            d === "sun" ? "text-red-400" : "text-slate-400"
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
            ? "border-slate-200 bg-[repeating-linear-gradient(135deg,#f1f5f9_0_6px,#e9edf3_6px_12px)]"
            : "border-slate-100 bg-white hover:border-blue-200";

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
                    ? "text-slate-400 line-through decoration-2 decoration-slate-300"
                    : isSun
                      ? "text-red-500"
                      : "text-slate-800"
              }`}
            >
              {cell.day}
            </span>

            {holiday ? (
              <span
                className={`text-[10.5px] font-bold leading-tight line-clamp-2 ${
                  isSelected ? "text-white" : "text-slate-600"
                }`}
              >
                {holiday.note || t("calendar.holidayBadge")}
              </span>
            ) : lessonCount > 0 ? (
              <span className="flex flex-col gap-1">
                <span className={`text-[11px] font-bold tabular-nums ${isSelected ? "text-white" : "text-slate-500"}`}>
                  {t("calendar.lessonsCount", { count: lessonCount })}
                </span>
                <span className={`h-1 rounded-full overflow-hidden ${isSelected ? "bg-white/30" : "bg-slate-100"}`}>
                  <span
                    className={`block h-full rounded-full ${isSelected ? "bg-white" : "bg-blue-500"}`}
                    style={{ width: `${Math.max(8, (lessonCount / maxLessons) * 100)}%` }}
                  />
                </span>
              </span>
            ) : (
              <span className={`text-[11px] ${isSelected ? "text-white/80" : "text-slate-300"}`}>—</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default MonthGrid;
