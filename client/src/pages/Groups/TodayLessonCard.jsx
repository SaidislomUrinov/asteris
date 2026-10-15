import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiAcademicCap, HiArrowsPointingOut } from "react-icons/hi2";
import HeaderCard from "./HeaderCard";
import TodayLessonDialog from "./TodayLessonDialog";

/**
 * "Bugungi dars" — guruh detali tepasidagi kartochkalar qatorining o'ng
 * chekkasida, FAQAT o'qituvchi va yordamchi o'qituvchi uchun. Ular sahifaga
 * kirishining asosiy sababi "bugun nima o'tyapman?" degan savol, shuning
 * uchun javob eng tepada, hech qayerga bosmasdan turadi.
 *
 * Bugun dars kuni bo'lmasa kartochka bo'sh qolmaydi — sarlavha "Keyingi
 * dars"ga aylanadi va kalendardagi eng yaqin dars kuni ko'rsatiladi.
 * Mavzu topilmasa (kurs dasturi hali tuzilmagan yoki darslar tugagan) —
 * "Mavzu biriktirilmagan".
 *
 * @param {Object|null} props.todayLesson - { date, lesson } bugungi dars kuni
 * @param {Object|null} props.nextLesson  - { date, lesson } eng yaqin keyingi
 * @param {Object} [props.group] - "Batafsil" modali uchun (vaqt, xona)
 */
function TodayLessonCard({ todayLesson, nextLesson, group }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const entry = todayLesson || nextLesson;
  const lesson = entry?.lesson || null;
  const isToday = !!todayLesson;

  return (
    <HeaderCard
      icon={<HiAcademicCap />}
      title={isToday ? t("group.todayLesson") : t("group.nextLesson")}
      subtitle={entry ? entry.date : t("group.noUpcomingLesson")}
      accent={isToday ? "amber" : "cyan"}
    >
      {!entry ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">{t("group.noLessonDay")}</p>
      ) : lesson ? (
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-night-800 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {t("syllabus.lessonNo", { no: lesson.no })}
            </span>
            {lesson.moduleTitle && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{lesson.moduleTitle}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{lesson.title}</p>
          {lesson.homework && (
            <p className="text-xs text-blue-600 dark:text-blue-400 line-clamp-1">
              <span className="text-slate-400 dark:text-slate-500">{t("syllabus.homeworkLabel")}: </span>
              {lesson.homework}
            </p>
          )}
        </div>
      ) : (
        // Dars kuni bor, ammo kurs dasturidan mavzu tushmagan.
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t("syllabus.unassigned")}</p>
      )}
      {/* "Batafsil" — sarlavha yonida emas, mazmun ostida: tor kartada (xl, 4 ustun)
          sarlavhani kesib qo'yardi. GroupDetail'dagi "O'zgartirish" havolasi uslubi. */}
      {entry && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start mt-1 inline-flex items-center gap-1 h-6 px-2 rounded-md bg-amber-50 dark:bg-amber-500/15 ring-1 ring-inset ring-amber-200 dark:ring-amber-400/30 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25 cursor-pointer whitespace-nowrap transition-colors"
        >
          <HiArrowsPointingOut className="text-sm shrink-0" />
          {t("group.lessonDetails")}
        </button>
      )}
      <TodayLessonDialog open={open} onClose={() => setOpen(false)} entry={entry} isToday={isToday} group={group} />
    </HeaderCard>
  );
}

export default TodayLessonCard;
