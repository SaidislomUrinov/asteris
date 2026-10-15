import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { api } from "../../utils/fetching";

/**
 * Kurs dasturidagi (Syllabus) uyga vazifali darslar ro'yxati — "Vazifa
 * yuborish" modalida "Dasturdan import" bosilganda ochiladi. Faqat
 * `homework` matni bor darslar ko'rsatiladi; shu kunga mos dars (agar
 * `suggestedId` ma'lum bo'lsa) birinchi va ajratilgan holda turadi.
 *
 * @param {Object} props
 * @param {string} props.groupId
 * @param {string} [props.suggestedId] - `lessonByDate[date]._id`
 * @param {(text: string) => void} props.onPick
 */
function HomeworkSyllabusPicker({ groupId, suggestedId, onPick }) {
  const { t } = useTranslation();
  const [lessons, setLessons] = useState(null); // null → yuklanmoqda
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await api.get(`/syllabus/${groupId}`);
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        const flat = [];
        for (const m of data?.modules || []) {
          for (const l of m.lessons || []) flat.push({ ...l, moduleTitle: m.title, no: flat.length + 1 });
        }
        if (alive) setLessons(flat.filter((l) => l.homework?.trim()));
      } catch {
        if (alive) {
          setFailed(true);
          setLessons([]);
        }
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [groupId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (lessons || []).filter(
      (l) => !q || `${l.title} ${l.homework} ${l.moduleTitle}`.toLowerCase().includes(q),
    );
    // Shu kunning darsi — tepada.
    return [...list].sort((a, b) => (b._id === suggestedId) - (a._id === suggestedId));
  }, [lessons, query, suggestedId]);

  if (lessons === null) {
    return (
      <div className="flex flex-col gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-night-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!lessons.length) {
    return (
      <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        {t(failed ? "common.error" : "homework.send.syllabusEmpty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {lessons.length > 5 && (
        <label className="flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-50 dark:bg-night-800 text-slate-400 dark:text-slate-500 focus-within:ring-2 ring-blue-500/20">
          <HiMagnifyingGlass className="shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("common.search")}
            className="flex-1 min-w-0 bg-transparent text-[13px] text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </label>
      )}
      <ul className="flex flex-col gap-1.5 max-h-60 overflow-y-auto -mx-1 px-1">
        {shown.map((l) => {
          const suggested = l._id === suggestedId;
          return (
            <li key={l._id}>
              <button
                type="button"
                onClick={() => onPick(l.homework.trim())}
                className={`flex flex-col gap-0.5 w-full px-3 py-2 rounded-xl border text-left cursor-pointer transition-colors ${
                  suggested
                    ? "border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 hover:bg-blue-50 dark:hover:bg-blue-500/15"
                    : "border-slate-100 dark:border-night-700 hover:border-slate-200 dark:hover:border-night-600 hover:bg-slate-50 dark:hover:bg-night-800"
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0 text-[12px]">
                  <span className="shrink-0 font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                    {t("syllabus.lessonNo", { no: l.no })}
                  </span>
                  <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{l.title}</span>
                  {suggested && (
                    <span className="ml-auto shrink-0 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      {t("homework.send.forThisDay")}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
                  {l.homework}
                </span>
              </button>
            </li>
          );
        })}
        {!shown.length && (
          <li className="py-4 text-center text-[13px] text-slate-400 dark:text-slate-500">{t("syllabus.importEmpty")}</li>
        )}
      </ul>
    </div>
  );
}

export default HomeworkSyllabusPicker;
