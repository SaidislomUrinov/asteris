import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheck } from "react-icons/hi2";

/**
 * "Hozir qaysi darsdamiz?" — joriy darsni tanlovchi
 * (API_CONTRACT_teaching_plans.md §6). Import dialogi va SyllabusTab
 * "Joriy darsni o'zgartirish" dialogi shu komponentni ishlatadi.
 *
 * Tanlangan dars = bugungi (yoki eng yaqin keyingi) dars; undan oldingilari
 * "o'tilgan" deb belgilanadi. Raqamlash butun dastur bo'ylab (1 dan).
 *
 * @param {Object} props
 * @param {Array<{_id, title, lessons: Array<{_id, title}>}>} props.modules - yengil daraxt
 * @param {number} [props.value=1] - currentLessonNo (yoyilgan ro'yxatda 1 dan)
 * @param {(no: number) => void} props.onChange
 */
function CurrentLessonPicker({ modules = [], value = 1, onChange }) {
  const { t } = useTranslation();

  // Har modulning birinchi darsi raqami va umumiy darslar soni.
  const { starts, total } = useMemo(() => {
    const list = [];
    let no = 0;
    for (const m of modules) {
      list.push(no + 1);
      no += (m.lessons || []).length;
    }
    return { starts: list, total: no };
  }, [modules]);

  const current = Math.min(Math.max(1, Number(value) || 1), Math.max(1, total));

  // Tanlangan dars joylashgan modul — boshlang'ich ochiq modul.
  const moduleOfValue = useMemo(() => {
    for (let i = modules.length - 1; i >= 0; i -= 1) {
      if ((modules[i].lessons || []).length && starts[i] <= current) return i;
    }
    return 0;
  }, [modules, starts, current]);

  const [moduleIdx, setModuleIdx] = useState(moduleOfValue);
  const activeIdx = Math.min(moduleIdx, Math.max(0, modules.length - 1));
  const activeModule = modules[activeIdx];
  const lessons = activeModule?.lessons || [];
  const first = starts[activeIdx] || 1;

  // Tanlangan dars ko'rinadigan bo'lishi uchun ro'yxat ichida suramiz.
  const selectedRef = useRef(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "center" });
  }, [activeIdx]);

  if (!total) {
    return <p className="py-6 text-center text-sm text-slate-400">{t("syllabus.pickerEmpty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3 w-full min-w-0">
      {/* Tanlangan dars — doim ko'rinib turadi */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-blue-200 bg-blue-50/60">
        <span className="flex items-center justify-center min-w-8 h-8 px-1.5 shrink-0 rounded-lg bg-blue-500 text-sm font-semibold tabular-nums text-white">
          {current}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
            {t("syllabus.todayLesson")}
          </span>
          <span className="text-xs text-slate-500">
            {t("syllabus.pickerSummary", { done: current - 1, n: current })}
          </span>
        </div>
      </div>

      {/* Modul tanlovi — gorizontal segmentlar (ko'p bo'lsa suriladi). */}
      <div className="flex gap-1.5 w-full min-w-0 overflow-x-auto pb-1">
        {modules.map((m, i) => {
          const active = i === activeIdx;
          const count = (m.lessons || []).length;
          return (
            <button
              key={m._id || `m-${i}`}
              type="button"
              onClick={() => setModuleIdx(i)}
              className={`flex flex-col items-start shrink-0 max-w-44 px-3 py-1.5 rounded-xl border text-left cursor-pointer transition-colors ${
                active
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <span className="text-xs font-semibold truncate w-full">{m.title}</span>
              <span className="text-[11px] tabular-nums opacity-70">
                {t("syllabus.moduleLessons", { count })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tanlangan modul darslari */}
      <div className="flex flex-col h-64 min-w-0 overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {lessons.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">{t("syllabus.noLessons")}</p>
        ) : (
          lessons.map((lesson, i) => {
            const no = first + i;
            const isDone = no < current;
            const isSelected = no === current;
            return (
              <button
                ref={isSelected ? selectedRef : null}
                key={lesson._id || `l-${no}`}
                type="button"
                onClick={() => onChange?.(no)}
                className={`flex items-center gap-3 px-3 py-2.5 text-left border-b border-slate-50 last:border-b-0 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-blue-50 border-l-2 border-l-blue-500"
                    : "hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-7 h-7 shrink-0 rounded-lg text-[13px] font-semibold tabular-nums ${
                    isSelected
                      ? "bg-blue-500 text-white"
                      : isDone
                        ? "bg-slate-100 text-slate-300"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {isDone ? <HiCheck /> : no}
                </span>
                <span
                  className={`min-w-0 flex-1 text-sm truncate ${
                    isSelected
                      ? "font-semibold text-slate-900"
                      : isDone
                        ? "text-slate-400"
                        : "text-slate-700"
                  }`}
                >
                  {lesson.title}
                </span>
                {isSelected && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-blue-100 text-[10px] font-semibold uppercase text-blue-600">
                    {t("syllabus.todayLesson")}
                  </span>
                )}
                {isDone && (
                  <span className="shrink-0 text-[11px] text-slate-400">{t("syllabus.passed")}</span>
                )}
                {!isDone && !isSelected && (
                  <span className="shrink-0 text-[11px] text-slate-300">{t("syllabus.upcomingLesson")}</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default CurrentLessonPicker;
