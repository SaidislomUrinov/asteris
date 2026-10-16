import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowsPointingOut, HiClipboardDocumentList } from "react-icons/hi2";
import HeaderCard from "./HeaderCard";
import LatestHomeworkDialog from "./LatestHomeworkDialog";
import { RESULT_OPTIONS, formatHomeworkDate } from "./homeworkResults";

/**
 * Guruh detali — tepadagi kartalar qatoridagi "Oxirgi vazifa" kartasi
 * (docs/API_CONTRACT_group_latest_homework.md). "Batafsil" — to'liq matn va
 * natijalar modali, undan "Uyga vazifa" tabiga o'tiladi. Ma'lumot
 * `useLatestHomework` orqali GroupDetail darajasida (guruh bilan parallel)
 * olinadi.
 *
 * @param {Object} props
 * @param {Object|null} props.item
 * @param {boolean} props.loaded
 * @param {() => void} props.onOpen
 * @param {number} [props.studentsCount] - "Belgilanmagan" sonini hisoblash uchun
 */
function LatestHomeworkCard({ item, loaded, onOpen, studentsCount }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!loaded) {
    return (
      <div className="max-sm:col-span-2 flex flex-col gap-2 max-sm:gap-1 p-3 pl-4 max-sm:p-2.5 max-sm:pl-3.5 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 min-w-0 animate-pulse">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 max-sm:hidden rounded-lg bg-slate-100 dark:bg-night-800" />
          <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-night-800" />
        </div>
        <div className="h-4 w-4/5 rounded bg-slate-100 dark:bg-night-800" />
        <div className="mt-auto pt-1">
          <div className="h-6 w-20 rounded-md bg-slate-100 dark:bg-night-800" />
        </div>
      </div>
    );
  }

  const results = Object.values(item?.results || {});
  const counts = Object.fromEntries(RESULT_OPTIONS.map((o) => [o.key, results.filter((r) => r === o.key).length]));
  counts.unmarked = Math.max(0, (studentsCount || 0) - results.length);
  const marked = results.length > 0;

  return (
    <HeaderCard
      className="max-sm:col-span-2"
      icon={<HiClipboardDocumentList />}
      title={t("homework.latest")}
      subtitle={item ? formatHomeworkDate(t, item.date) : null}
      accent="amber"
    >
      {item ? (
        <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line break-words line-clamp-2 max-sm:line-clamp-1">
          {item.text}
        </p>
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-500">{t("homework.latestEmpty")}</p>
      )}
      {/* "Batafsil" — TodayLessonCard bilan bir xil: mazmun ostida, chapda.
          O'ngda natijalar xulosasi (belgilangan bo'lsa). */}
      {item && (
        <div className="flex items-center gap-2 mt-auto pt-1 min-w-0">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md bg-amber-50 dark:bg-amber-500/15 ring-1 ring-inset ring-amber-200 dark:ring-amber-400/30 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25 cursor-pointer whitespace-nowrap transition-colors"
          >
            <HiArrowsPointingOut className="text-sm shrink-0" />
            {t("group.lessonDetails")}
          </button>
          {marked && (
            <span className="ml-auto flex items-center gap-2 min-w-0 overflow-hidden">
              {RESULT_OPTIONS.map((o) => (
                <span
                  key={o.key}
                  title={t(`homework.results.${o.key}`)}
                  className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${o.text}`}
                >
                  <o.icon className="text-xs shrink-0" />
                  {counts[o.key]}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
      <LatestHomeworkDialog
        open={open}
        onClose={() => setOpen(false)}
        item={item}
        counts={counts}
        onOpenTab={onOpen}
      />
    </HeaderCard>
  );
}

export default LatestHomeworkCard;
