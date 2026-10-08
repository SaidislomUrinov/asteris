import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiCalendarDays,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineNoSymbol,
  HiXMark,
} from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useCan from "../../hooks/useCan";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import Loading from "../../ui/Loading";
import MarkHolidayDialog from "./MarkHolidayDialog";
import MonthGrid from "./MonthGrid";
import MonthSummary from "./MonthSummary";
import MobileDayList from "./MobileDayList";
import useMediaQuery from "../../hooks/useMediaQuery";
import { JS_DAY_TO_CODE, dateKey, monthKey } from "./calendarUtils";

// Markaz darajasidagi umumiy kalendar — oy grid'ida shu Center'dagi BARCHA
// faol guruhlarning shu kunga to'g'ri keladigan darslar soni ko'rsatiladi
// (backend hisoblaydi). Bir yoki bir nechta kunni tanlab "Dam olish qilish"
// bilan CenterHoliday sifatida belgilash mumkin — bu GroupHoliday'dan
// (guruh darajasi, LessonCalendar.jsx) mutlaqo mustaqil yozuv.
function Calendar() {
  const { t } = useTranslation();
  const monthNames = t("common.monthNames", { returnObjects: true });
  const can = useCan();

  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [days, setDays] = useState({}); // { "YYYY-MM-DD": { lessonCount, holiday, cancelledByHoliday } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState([]); // ["YYYY-MM-DD", ...]
  const [rangeStart, setRangeStart] = useState(null);
  const [markOpen, setMarkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unmarking, setUnmarking] = useState(null); // sana | null
  const [listSelected, setListSelected] = useState([]); // ro'yxatdagi tanlangan dam olish kunlari
  const [bulkUnmarking, setBulkUnmarking] = useState(false);

  const canManage = can("calendar:manage");
  // Desktop — oy jadvali + xulosa (1-shablon), telefon/planshet — kunlar ro'yxati (5-shablon).
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const monthStr = monthKey(viewDate);

  // Client Owner bir nechta Centerga ega bo'lishi mumkin — dropdown faqat
  // shunda ko'rsatiladi (Dashboard/index.jsx bilan bir xil pattern).
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/centers", { params: { page: 1 } });
        if (res.data.ok) {
          const list = res.data.data || [];
          setCenters(list);
          if (!centerId && list.length) setCenterId(list[0]._id);
          // Markaz yo'q — oy so'rovi hech qachon ketmaydi, spinner abadiy
          // qolmasin: "markaz tanlanmagan" bo'sh holati ko'rinsin.
          if (!list.length) setLoading(false);
        }
      } catch {
        // markazlar faqat filtr uchun, jim o'tkazamiz
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMonth = useCallback(async () => {
    if (!centerId) return;
    try {
      setLoading(true);
      setError(false);
      const res = await api.get(`/calendar/${centerId}/${monthStr}`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      const map = {};
      for (const d of data?.days || []) map[d.date] = d;
      setDays(map);
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [centerId, monthStr]);

  useEffect(() => {
    const id = setTimeout(() => {
      setSelected([]);
      setRangeStart(null);
      setListSelected([]);
    }, 0);
    return () => clearTimeout(id);
  }, [centerId, monthStr]);

  // Shu oy uchun dam olish deb belgilangan kunlar ro'yxati (o'ng panel)
  const holidayList = useMemo(
    () =>
      Object.entries(days)
        .filter(([, v]) => !!v?.holiday)
        .map(([date, v]) => ({ date, note: v.holiday?.note || "" }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [days],
  );

  const toggleListSelected = (date) =>
    setListSelected((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date],
    );

  const unmarkListSelected = async () => {
    if (!listSelected.length) return;
    try {
      setBulkUnmarking(true);
      for (const date of listSelected) {
        await api.delete(`/calendar/${centerId}/${date}`);
      }
      successMsg(t("calendar.unmarked"));
      setListSelected([]);
      fetchMonth();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setBulkUnmarking(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(fetchMonth, 0);
    return () => clearTimeout(id);
  }, [fetchMonth]);

  useSocketEvent("calendar:updated", (p) => {
    if (p?.centerId === centerId) fetchMonth();
  });

  const cells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // dushanbadan boshlanadi

    const result = Array.from({ length: leadingBlanks }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const key = dateKey(d);
      result.push({ day, key, weekdayCode: JS_DAY_TO_CODE[d.getDay()] });
    }
    return result;
  }, [viewDate]);

  const changeMonth = (delta) =>
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const todayKey = dateKey(new Date());

  const toggleDay = (key, e) => {
    if (!canManage) return;
    if (e?.shiftKey && rangeStart) {
      // Oraliq tanlash: shift bosib bosilsa, oxirgi boshlang'ich va shu kun
      // orasidagi barcha kunlar qo'shiladi.
      const [a, b] = [rangeStart, key].sort();
      const start = new Date(a);
      const end = new Date(b);
      const range = [];
      const cursor = new Date(start);
      while (cursor <= end) {
        range.push(dateKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      setSelected((prev) => Array.from(new Set([...prev, ...range])));
      return;
    }
    setRangeStart(key);
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key],
    );
  };

  const clearSelection = () => {
    setSelected([]);
    setRangeStart(null);
  };

  const markSelected = async (note) => {
    try {
      setSaving(true);
      const res = await api.post(`/calendar/${centerId}/mark`, { dates: selected, note });
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || "calendar.marked");
      setMarkOpen(false);
      clearSelection();
      fetchMonth();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const unmarkDay = async (key) => {
    try {
      setUnmarking(key);
      const res = await api.delete(`/calendar/${centerId}/${key}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || "calendar.unmarked");
      fetchMonth();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setUnmarking(null);
    }
  };

  if (!centerId && !loading) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
        <HiCalendarDays className="text-4xl" />
        <p className="text-sm">{t("calendar.noCenters")}</p>
      </div>
    );
  }

  const hasSelection = selected.length > 0;
  const dayValues = Object.values(days);
  const stats = {
    lessons: dayValues.filter((d) => !d.holiday).reduce((sum, d) => sum + (d.lessonCount || 0), 0),
    workDays: dayValues.filter((d) => !d.holiday && d.lessonCount > 0).length,
    holidays: holidayList.length,
    cancelled: dayValues.filter((d) => d.holiday).reduce((sum, d) => sum + (d.lessonCount || 0), 0),
  };
  const maxLessons = Math.max(1, ...dayValues.map((d) => d.lessonCount || 0));

  const onDayClick = (key, e, isHoliday) => (isHoliday ? unmarkDay(key) : toggleDay(key, e));

  const selectionActions = (
    <>
      <Button variant="outlined" color="black" className="text-xs" onClick={clearSelection}>
        <HiXMark className="text-base" />
        {t("common.cancel")}
      </Button>
      <Button color="red" className="gap-1.5 text-xs" onClick={() => setMarkOpen(true)}>
        <HiOutlineNoSymbol className="text-base" />
        {t("calendar.markAction")}
      </Button>
    </>
  );

  const body =
    loading && !Object.keys(days).length ? (
      <Loading height="36vh" />
    ) : error ? (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500 py-10">
        <HiCalendarDays className="text-4xl" />
        <p className="text-sm">{t("calendar.loadError")}</p>
        <Button variant="outlined" onClick={fetchMonth}>
          {t("common.retry")}
        </Button>
      </div>
    ) : null;

  return (
    <div className="flex flex-col w-full h-full gap-3 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center gap-2.5 p-2.5 lg:p-3 rounded-2xl border border-slate-200/80 dark:border-night-700/80 bg-white dark:bg-night-900">
        <div className="hidden lg:flex items-center gap-2.5 flex-1 min-w-[160px]">
          <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-500 text-lg">
            <HiCalendarDays />
          </span>
          <span className="text-base font-space font-bold text-slate-900 dark:text-slate-100 truncate">
            {centers.length > 1 ? t("calendar.title") : centers[0]?.name || t("calendar.title")}
          </span>
        </div>

        {centers.length > 1 && (
          <Select
            className="flex-1 lg:flex-none lg:w-52 min-w-0"
            placeholder={t("dashboard.center")}
            variant="white"
            value={centerId}
            onChange={setCenterId}
            options={centers.map((c) => ({ value: c._id, label: c.name }))}
          />
        )}

        <div className="flex items-center gap-0.5 p-1 rounded-xl border border-slate-200 dark:border-night-700 bg-slate-50 dark:bg-night-800 max-lg:ml-auto">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 bg-white dark:bg-night-900 shadow-sm dark:shadow-none hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer"
          >
            <HiChevronLeft />
          </button>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 min-w-28 lg:min-w-32 text-center select-none">
            {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 bg-white dark:bg-night-900 shadow-sm dark:shadow-none hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer"
          >
            <HiChevronRight />
          </button>
        </div>
      </div>

      {isDesktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-3 items-start">
          <div className="flex flex-col gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-night-700/80 bg-white dark:bg-night-900">
            {body || (
              <>
                <MonthGrid
                  cells={cells}
                  days={days}
                  selected={selected}
                  todayKey={todayKey}
                  canManage={canManage}
                  unmarking={unmarking}
                  maxLessons={maxLessons}
                  onDayClick={onDayClick}
                />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2.5 border-t border-slate-100 dark:border-night-700 text-[11.5px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {t("calendar.lessonCountLegend")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-night-600" />
                    {t("calendar.holidayBadge")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-500" />
                    {t("group.todayLegend")}
                  </span>
                  {canManage && !hasSelection && <span className="ml-auto text-slate-400 dark:text-slate-500">{t("calendar.selectHint")}</span>}
                </div>
                {canManage && hasSelection && (
                  <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/15">
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex-1 min-w-[140px]">
                      {t("calendar.selectedCount", { count: selected.length })}
                    </p>
                    {selectionActions}
                  </div>
                )}
              </>
            )}
          </div>

          <MonthSummary
            stats={stats}
            monthName={monthNames[viewDate.getMonth()]}
            holidayList={holidayList}
            days={days}
            canManage={canManage}
            listSelected={listSelected}
            onToggle={toggleListSelected}
            unmarking={unmarking}
            onUnmark={unmarkDay}
            bulkUnmarking={bulkUnmarking}
            onBulkUnmark={unmarkListSelected}
          />
        </div>
      ) : (
        <>
          {body || (
            <MobileDayList
              cells={cells}
              days={days}
              stats={stats}
              selected={selected}
              todayKey={todayKey}
              canManage={canManage}
              unmarking={unmarking}
              onToggle={(key) => toggleDay(key)}
              onUnmark={unmarkDay}
            />
          )}
          {/* Tanlov paneli tab-bar ustida qotadi; ro'yxat oxiri uning ostida qolmasin. */}
          {canManage && hasSelection && (
            <>
              <div className="h-32 shrink-0" />
              <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-2 flex flex-col gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-lg dark:shadow-none shadow-slate-900/15">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t("calendar.selectedCount", { count: selected.length })}
                </p>
                <div className="grid grid-cols-2 gap-2 [&>button]:w-full">{selectionActions}</div>
              </div>
            </>
          )}
        </>
      )}

      <MarkHolidayDialog
        open={markOpen}
        onClose={() => setMarkOpen(false)}
        dates={selected}
        onConfirm={markSelected}
        saving={saving}
      />
    </div>
  );
}

export default Calendar;
