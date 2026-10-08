import { useTranslation } from "react-i18next";
import { HiOutlineNoSymbol, HiTrash, HiXMark } from "react-icons/hi2";
import Button from "../../ui/Button";
import Checkbox from "../../ui/Checkbox";
import { JS_DAY_TO_CODE } from "./calendarUtils";

// Desktop o'ng paneli: oy xulosasi + shu oydagi dam olishlar ro'yxati
// (belgilab ommaviy bekor qilish bilan).
function MonthSummary({ stats, monthName, holidayList, days, canManage, listSelected, onToggle, unmarking, onUnmark, bulkUnmarking, onBulkUnmark }) {
  const { t } = useTranslation();
  const tiles = [
    { key: "statLessons", value: stats.lessons },
    { key: "statWorkDays", value: stats.workDays },
    { key: "statHolidays", value: stats.holidays },
    { key: "statCancelled", value: stats.cancelled },
  ];

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 dark:border-night-700/80 bg-white dark:bg-night-900">
      <div className="grid grid-cols-2 gap-2 p-3">
        {tiles.map((tile) => (
          <div key={tile.key} className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-night-800">
            <span className="font-space text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums leading-tight">{tile.value}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{t(`calendar.${tile.key}`)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pt-1 pb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {t("calendar.holidayListTitle", { month: monthName })}
        </p>
        <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold">
          {holidayList.length}
        </span>
      </div>

      {!holidayList.length ? (
        <div className="flex flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-600 px-4 pb-6 pt-3">
          <HiOutlineNoSymbol className="text-2xl" />
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">{t("calendar.noHolidaysThisMonth")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 px-3 pb-3 max-h-80 overflow-y-auto">
          {holidayList.map(({ date, note }) => {
            const weekdayCode = JS_DAY_TO_CODE[new Date(date).getDay()];
            const lessons = days[date]?.lessonCount || 0;
            const isChecked = listSelected.includes(date);
            return (
              <div
                key={date}
                className={`group flex items-center gap-2.5 p-2 rounded-xl border transition-colors duration-150 ${
                  isChecked ? "border-blue-300 bg-blue-50/70 dark:bg-blue-500/15" : "border-slate-100 dark:border-night-700 hover:bg-slate-50 dark:hover:bg-night-800"
                }`}
              >
                {canManage && <Checkbox variant="square" checked={isChecked} onChange={() => onToggle(date)} />}
                <span className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-night-800 shrink-0 leading-none">
                  <span className="font-space text-sm font-bold text-slate-700 dark:text-slate-300">{Number(date.slice(-2))}</span>
                  <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 mt-0.5">
                    {t(`group.dayShort.${weekdayCode}`)}
                  </span>
                </span>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {note || t("calendar.holidayBadge")}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {lessons ? t("calendar.cancelledLessons", { count: lessons }) : t("calendar.noLessons")}
                  </span>
                </div>
                {canManage && (
                  <button
                    type="button"
                    title={t("calendar.unmarkAction")}
                    disabled={unmarking === date}
                    onClick={() => onUnmark(date)}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/15 disabled:opacity-50 shrink-0 transition-colors cursor-pointer"
                  >
                    <HiXMark className="text-sm" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canManage && listSelected.length > 0 && (
        <div className="flex items-center gap-2 mx-3 mb-3 pt-2 border-t border-slate-100 dark:border-night-700">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 flex-1">
            {t("calendar.selectedCount", { count: listSelected.length })}
          </p>
          <Button variant="outlined" color="red" className="text-xs gap-1.5" loading={bulkUnmarking} onClick={onBulkUnmark}>
            <HiTrash className="text-base" />
            {t("calendar.unmarkSelected", { count: listSelected.length })}
          </Button>
        </div>
      )}
    </div>
  );
}

export default MonthSummary;
