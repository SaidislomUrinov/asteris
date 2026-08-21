import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import HolidayDialog from "./HolidayDialog";
import LessonDayDialog from "./LessonDayDialog";
import { dateKey } from "./useLessonSchedule";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const WEEK_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const JS_DAY_TO_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Guruh dars jadvalini (haftalik kunlar) kalendar ko'rinishida ko'rsatadi —
// oldingi/keyingi oylarni ko'rish mumkin. `status`ga qarab rang farqlanadi:
// - "pending": mos kunlar hira ko'k (taxminiy, hali start berilmagan)
// - "active"/"finished": mos kunlar to'liq ko'k, LEKIN faqat `activatedAt`
//   (darslar boshlangan sana)dan boshlab — undan oldingi oylardagi mos
//   kunlar endi ko'rsatilmaydi (darslar hali boshlanmagan edi).
// Haqiqiy ("lesson") kunlardan birini bosib, uni dam olish kuni deb e'lon
// qilish mumkin — shu paytda to'lov davom etsinmi yoki yo'qmi ham hal
// qilinadi (HolidayDialog, group-holidays endpointlari).
//
// `showPlans` (o'qituvchi/yordamchi) yoqilganda esa kunga bosish MUTLAQO
// boshqa ma'no kasb etadi: ular dam olish kuni belgilamaydi, o'rniga shu
// kunning dars mavzusi ko'rsatiladi (docs/teacher-scope-updates.md §2).
// Mavzu endi QO'LDA biriktirilmaydi — kurs dasturidagi darslar dars
// kunlariga ketma-ket tushadi (API_CONTRACT_syllabus.md §3):
//   dars kunlari ro'yxatining k-indeksi  ↔  lessons[k + lessonOffset]
// Dam olish deb belgilangan kunlar ro'yxatdan tushib qoladi. Reja
// tugagach — "Mavzu biriktirilmagan".
function LessonCalendar({
  groupId,
  days = [],
  status,
  activatedAt,
  finishedAt,
  onChange,
  showPlans = false,
  schedule,
}) {
  const { t } = useTranslation();
  const monthNames = t("common.monthNames", { returnObjects: true });
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [holidayTarget, setHolidayTarget] = useState(null); // "YYYY-MM-DD" | null
  const [planTarget, setPlanTarget] = useState(null); // "YYYY-MM-DD" | null
  const [saving, setSaving] = useState(false);

  // Dam olish kunlari va sana→mavzu moslashuvi `useLessonSchedule` da —
  // "Bugungi dars" kartochkasi bilan BITTA manbadan oziqlanadi
  // (GroupDetail hookni bir marta chaqirib, natijani shu yerga uzatadi).
  const { holidays, lessonByDate, extendTo, refetchMonth } = schedule;

  const monthStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}`;

  // Oy oldinga surilganda hisob oralig'i cho'ziladi (kerakli oylarning dam
  // olish kunlari ham o'sha yerda yuklab olinadi).
  useEffect(() => {
    extendTo(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0));
  }, [viewDate, extendTo]);

  const activatedKey = activatedAt ? dateKey(new Date(activatedAt * 1000)) : null;
  const finishedKey = finishedAt ? dateKey(new Date(finishedAt * 1000)) : null;
  const todayKey = dateKey(new Date());

  const cells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // dushanbadan boshlanadigan hafta

    const result = Array.from({ length: leadingBlanks }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const weekdayCode = JS_DAY_TO_CODE[d.getDay()];
      const key = dateKey(d);
      const isLessonWeekday = days.includes(weekdayCode);

      let variant = "none";
      if (isLessonWeekday) {
        if (status === "pending") {
          variant = "estimated";
        } else if (activatedKey && key >= activatedKey && (!finishedKey || key <= finishedKey)) {
          variant = "lesson";
        }
      }

      result.push({ day, key, variant, weekdayCode });
    }
    return result;
  }, [viewDate, days, status, activatedKey, finishedKey]);

  const changeMonth = (delta) =>
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const markHoliday = async (chargeable, note = "") => {
    try {
      setSaving(true);
      const res = await api.post(`/group-holidays/${groupId}`, {
        date: holidayTarget,
        chargeable,
        note,
      });
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setHolidayTarget(null);
      refetchMonth(monthStr);
      onChange?.();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const unmarkHoliday = async () => {
    try {
      setSaving(true);
      const res = await api.delete(`/group-holidays/${groupId}/${holidayTarget}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setHolidayTarget(null);
      refetchMonth(monthStr);
      onChange?.();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 bg-white h-full">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <p className="font-semibold text-slate-800">{t("group.calendarTitle")}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <HiChevronLeft />
          </button>
          <span className="text-sm font-medium text-slate-600 min-w-32 text-center">
            {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <HiChevronRight />
          </button>
        </div>
      </div>

      {/* max-w — grid butun kenglikka cho'zilsa kataklar juda keng
          to'rtburchakka aylanib ketardi; markazda cheklab qo'yamiz. */}
      <div className="grid grid-cols-7 gap-1 text-center w-full max-w-sm mx-auto">
        {WEEK_ORDER.map((d) => (
          <span
            key={d}
            className={`text-[11px] lg:text-xs font-bold uppercase py-1 ${
              d === "sun" ? "text-red-400" : "text-slate-600"
            }`}
          >
            {t(`group.dayShort.${d}`)}
          </span>
        ))}

        {cells.map((cell, i) => {
          if (cell === null) return <span key={`b-${i}`} />;
          const holiday = holidays[cell.key];
          const dayLesson = lessonByDate[cell.key] || null;
          const clickable = cell.variant === "lesson" && !!groupId;

          return (
            <button
              key={cell.day}
              type="button"
              disabled={!clickable}
              title={
                holiday
                  ? `${t("group.monthlyHoliday")} — ${
                      holiday.note ||
                      t(holiday.chargeable ? "group.holidayChargeable" : "group.holidayNotChargeable")
                    }`
                  : !clickable
                    ? undefined
                    : showPlans
                      ? dayLesson?.title || t("syllabus.unassigned")
                      : t("group.holidayClickHint")
              }
              onClick={() =>
                clickable && (showPlans ? setPlanTarget(cell.key) : setHolidayTarget(cell.key))
              }
              // Balandlik QAT'IY (`h-9`/`h-10`) — avval `aspect-square` edi,
              // ya'ni katak kenglik bilan birga kattalashib, keng ekranda
              // kalendar ~440px ga cho'zilib ketardi va sahifani keraksiz
              // scroll'ga majburlardi.
              className={`relative flex items-center justify-center h-9 lg:h-10 rounded-lg text-sm lg:text-base font-medium lg:font-semibold transition-colors ${
                clickable ? "cursor-pointer" : "cursor-default"
              } ${cell.key === todayKey ? "ring-2 ring-violet-500 ring-inset" : ""} ${
                holiday
                  ? holiday.chargeable
                    ? "bg-blue-200 text-blue-700 line-through decoration-2"
                    : "bg-slate-200 text-slate-400 line-through decoration-2"
                  : cell.variant === "lesson"
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : cell.variant === "estimated"
                      ? "bg-blue-100 text-blue-400"
                      : cell.weekdayCode === "sun"
                        ? "text-red-500"
                        : "text-slate-600"
              }`}
            >
              {cell.day}
              {/* Mavzu yozilgan kun — pastda kichik nuqta. */}
              {showPlans && dayLesson && !holiday && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/90" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500 shrink-0">
        {status === "pending" ? (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-blue-200" />
            <span>{t("group.estimatedLessonDays")}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>{t("group.lessonDays")}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
          <span>{t("group.holidayLegend")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-violet-500" />
          <span>{t("group.todayLegend")}</span>
        </div>
      </div>

      <LessonDayDialog
        key={planTarget || "no-plan"}
        open={!!planTarget}
        onClose={() => setPlanTarget(null)}
        date={planTarget}
        lesson={planTarget ? lessonByDate[planTarget] || null : null}
      />

      <HolidayDialog
        key={holidayTarget || "none"}
        open={!!holidayTarget}
        onClose={() => setHolidayTarget(null)}
        date={holidayTarget}
        existing={holidayTarget ? holidays[holidayTarget] : null}
        onMark={markHoliday}
        onUnmark={unmarkHoliday}
        saving={saving}
      />
    </div>
  );
}

export default LessonCalendar;
