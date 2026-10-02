import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { HiCheck } from "react-icons/hi2";

// Telefon ko'rinishi (5-shablon): oy xulosasi chiplari, gorizontal kun lentasi
// va har kun alohida karta. Tanlov/amallar ota sahifada.
function MobileDayList({ cells, days, stats, selected, todayKey, canManage, unmarking, onToggle, onUnmark }) {
  const { t } = useTranslation();
  const list = cells.filter(Boolean);
  const stripRef = useRef(null);

  // Joriy oy ochilganda lenta bugungi kunga suriladi.
  useEffect(() => {
    const el = stripRef.current?.querySelector('[data-today="true"]');
    if (el) el.scrollIntoView({ inline: "center", block: "nearest" });
  }, [cells]);

  const jumpTo = (key) => document.getElementById(`cal-day-${key}`)?.scrollIntoView({ block: "center", behavior: "smooth" });

  const chips = [
    { value: stats.lessons, label: t("calendar.statLessonsShort") },
    { value: stats.workDays, label: t("calendar.statWorkDaysShort") },
    { value: stats.holidays, label: t("calendar.statHolidaysShort") },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2">
        {chips.map((c) => (
          <div key={c.label} className="flex flex-col px-3 py-2 rounded-xl border border-slate-200 bg-white">
            <span className="font-space text-lg font-bold text-slate-900 tabular-nums leading-tight">{c.value}</span>
            <span className="text-[11px] text-slate-500 truncate">{c.label}</span>
          </div>
        ))}
      </div>

      <div ref={stripRef} className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        {list.map((cell) => {
          const isToday = cell.key === todayKey;
          const holiday = days[cell.key]?.holiday;
          return (
            <button
              key={cell.key}
              type="button"
              data-today={isToday}
              onClick={() => jumpTo(cell.key)}
              className={`flex flex-col items-center justify-center shrink-0 w-12 h-15 rounded-2xl border cursor-pointer ${
                isToday
                  ? "bg-slate-900 border-slate-900 text-white"
                  : holiday
                    ? "bg-red-50 border-red-200 text-slate-700"
                    : "bg-white border-slate-200 text-slate-700"
              }`}
            >
              <span className={`text-[10px] font-bold uppercase ${isToday ? "text-white/60" : "text-slate-400"}`}>
                {t(`group.dayShort.${cell.weekdayCode}`)}
              </span>
              <span className="font-space text-base font-bold tabular-nums">{cell.day}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {list.map((cell) => {
          const info = days[cell.key];
          const holiday = info?.holiday || null;
          const lessons = info?.lessonCount ?? 0;
          const isSun = cell.weekdayCode === "sun";
          const isToday = cell.key === todayKey;
          const isSelected = selected.includes(cell.key);
          const selectable = canManage && !holiday;
          const weekStart = cell.weekdayCode === "mon";

          const title = holiday
            ? holiday.note || t("calendar.holidayBadge")
            : lessons
              ? t("calendar.lessonsCount", { count: lessons })
              : t("calendar.noLessons");
          const subtitle = holiday
            ? t("calendar.holidayCancelled")
            : isToday
              ? t("calendar.today")
              : lessons
                ? t("calendar.byGroupSchedule")
                : t(`group.day.${cell.weekdayCode}`);

          return (
            <div key={cell.key} className="flex flex-col gap-2">
              {weekStart && cell.day > 1 && <div className="h-px bg-slate-200 mx-1 my-1" />}
              <div
                id={`cal-day-${cell.key}`}
                role={selectable ? "button" : undefined}
                tabIndex={selectable ? 0 : undefined}
                onClick={() => selectable && onToggle(cell.key)}
                onKeyDown={(e) => selectable && (e.key === "Enter" || e.key === " ") && onToggle(cell.key)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-colors ${
                  isSelected
                    ? "border-blue-400 bg-blue-50"
                    : holiday
                      ? "border-red-200 bg-red-50"
                      : isToday
                        ? "border-slate-900 bg-white"
                        : "border-slate-200 bg-white"
                } ${selectable ? "cursor-pointer" : ""}`}
              >
                <div className="flex flex-col items-center w-10 shrink-0 leading-none">
                  <span className={`font-space text-xl font-bold tabular-nums ${isSun ? "text-red-500" : "text-slate-900"}`}>
                    {cell.day}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-slate-400 mt-1">
                    {t(`group.dayShort.${cell.weekdayCode}`)}
                  </span>
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className={`text-sm font-semibold ${holiday ? "text-red-700 line-clamp-2" : "text-slate-800 truncate"}`}>{title}</span>
                  <span className="text-xs text-slate-400 truncate">{subtitle}</span>
                </div>
                {holiday && canManage ? (
                  <button
                    type="button"
                    disabled={unmarking === cell.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnmark(cell.key);
                    }}
                    className="shrink-0 px-2.5 h-8 rounded-lg bg-red-100 text-red-700 text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    {t("calendar.unmarkShort")}
                  </button>
                ) : selectable ? (
                  <span
                    className={`flex items-center justify-center shrink-0 w-6 h-6 rounded-lg border-[1.5px] ${
                      isSelected ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 bg-white"
                    }`}
                  >
                    {isSelected && <HiCheck className="text-sm" />}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MobileDayList;
