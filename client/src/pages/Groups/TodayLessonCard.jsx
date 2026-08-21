import { useTranslation } from "react-i18next";
import { HiAcademicCap } from "react-icons/hi2";
import MetricCard from "../../ui/MetricCard";

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
 */
function TodayLessonCard({ todayLesson, nextLesson }) {
  const { t } = useTranslation();

  const entry = todayLesson || nextLesson;
  const lesson = entry?.lesson || null;
  const isToday = !!todayLesson;

  return (
    <MetricCard
      icon={<HiAcademicCap />}
      title={isToday ? t("group.todayLesson") : t("group.nextLesson")}
      subtitle={entry ? entry.date : t("group.noUpcomingLesson")}
      accent={isToday ? "amber" : "cyan"}
    >
      {!entry ? (
        <p className="text-sm text-slate-400">{t("group.noLessonDay")}</p>
      ) : lesson ? (
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[11px] text-slate-500 tabular-nums">
              {t("syllabus.lessonNo", { no: lesson.no })}
            </span>
            {lesson.moduleTitle && (
              <span className="text-[11px] text-slate-400 truncate">{lesson.moduleTitle}</span>
            )}
          </div>
          <p className="font-semibold text-slate-800 line-clamp-2">{lesson.title}</p>
          {lesson.homework && (
            <p className="text-xs text-blue-600 line-clamp-2">
              <span className="text-slate-400">{t("syllabus.homeworkLabel")}: </span>
              {lesson.homework}
            </p>
          )}
        </div>
      ) : (
        // Dars kuni bor, ammo kurs dasturidan mavzu tushmagan.
        <p className="text-sm font-medium text-slate-400">{t("syllabus.unassigned")}</p>
      )}
    </MetricCard>
  );
}

export default TodayLessonCard;
