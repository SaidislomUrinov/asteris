import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";

const WEEK_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const STATUS_STYLE = {
  present: "bg-emerald-500 text-white hover:bg-emerald-600",
  absent: "bg-red-500 text-white hover:bg-red-600",
  excused: "bg-orange-500 text-white hover:bg-orange-600",
};

const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// O'quvchining bitta guruhdagi davomat tarixini kalendar ko'rinishida
// ko'rsatadi — LessonCalendar.jsx bilan bir xil vizual naqsh (oy
// navigatsiyasi, 7x hafta grid), lekin dars kunini emas, har kunning
// haqiqiy davomat holatini (Keldi/Kelmadi/Sababli) rangda ko'rsatadi.
// Kun ustiga qo'yilganda holat + sabab hover-tooltip'da chiqadi.
function AttendanceCalendar({ records = [] }) {
  const { t } = useTranslation();
  const monthNames = t("common.monthNames", { returnObjects: true });

  const recordMap = useMemo(
    () => Object.fromEntries(records.map((r) => [r.date, r])),
    [records],
  );

  const [viewDate, setViewDate] = useState(() => {
    const latest = records[0]?.date; // backend eng yangisini birinchi qaytaradi
    if (latest) {
      const [y, m] = latest.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const todayKey = dateKey(new Date());
  const changeMonth = (delta) =>
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const cells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

    const result = Array.from({ length: leadingBlanks }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKey(new Date(year, month, day));
      result.push({ day, key, record: recordMap[key] });
    }
    return result;
  }, [viewDate, recordMap]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-night-800 transition-colors cursor-pointer"
        >
          <HiChevronLeft />
        </button>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-night-800 transition-colors cursor-pointer"
        >
          <HiChevronRight />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK_ORDER.map((d) => (
          <span
            key={d}
            className={`text-[11px] font-bold uppercase py-1 ${
              d === "sun" ? "text-red-400" : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {t(`group.dayShort.${d}`)}
          </span>
        ))}

        {cells.map((cell, i) => {
          if (cell === null) return <span key={`b-${i}`} />;
          const { record } = cell;

          return (
            <div key={cell.day} className="relative group">
              <div
                className={`flex items-center justify-center aspect-square rounded-lg text-sm font-medium transition-colors ${
                  cell.key === todayKey ? "ring-2 ring-violet-500 ring-inset" : ""
                } ${record ? STATUS_STYLE[record.status] : "text-slate-500 dark:text-slate-400"}`}
              >
                {cell.day}
              </div>

              {record && (
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 hidden group-hover:flex flex-col items-center whitespace-nowrap">
                  <div className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs shadow-lg flex flex-col items-center gap-0.5">
                    <span className="font-semibold">{t(`group.attendance${record.status[0].toUpperCase()}${record.status.slice(1)}`)}</span>
                    {record.reason && <span className="text-slate-300 dark:text-slate-600">{record.reason}</span>}
                  </div>
                  <div className="w-2 h-2 -mt-1 rotate-45 bg-slate-800" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-night-700 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>{t("group.attendancePresent")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
          <span>{t("group.attendanceExcused")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span>{t("group.attendanceAbsent")}</span>
        </div>
      </div>
    </div>
  );
}

export default AttendanceCalendar;
