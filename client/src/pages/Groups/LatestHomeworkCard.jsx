import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowsPointingOut, HiClipboardDocumentList } from "react-icons/hi2";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import HeaderCard from "./HeaderCard";
import LatestHomeworkDialog from "./LatestHomeworkDialog";
import { RESULT_OPTIONS, formatHomeworkDate } from "./homeworkResults";

/**
 * Guruh detali — tepadagi kartalar qatoridagi "Oxirgi vazifa" kartasi
 * (docs/API_CONTRACT_group_latest_homework.md). "Batafsil" — to'liq matn va
 * natijalar modali, undan "Uyga vazifa" tabiga o'tiladi. Boshqa xodim vazifa
 * yozsa yoki natija qo'ysa (`homework:updated|results`) qayta so'raladi.
 *
 * @param {Object} props
 * @param {string} props.groupId
 * @param {() => void} props.onOpen
 * @param {number} [props.studentsCount] - "Belgilanmagan" sonini hisoblash uchun
 */
function LatestHomeworkCard({ groupId, onOpen, studentsCount }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/homework/${groupId}/latest`);
      if (!data.ok) throw new Error(data.msg);
      setItem(data.data?.item || null);
    } catch {
      // Ikkinchi darajali karta — xato bo'lsa jim yashiriladi.
      setItem(null);
    } finally {
      setLoaded(true);
    }
  }, [groupId]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  const onChanged = useCallback(
    (p) => {
      if (p?.groupId === groupId) load();
    },
    [groupId, load],
  );
  useSocketEvent("homework:updated", onChanged, !!groupId);
  useSocketEvent("homework:results", onChanged, !!groupId);

  if (!loaded) {
    return <div className="max-sm:col-span-2 min-h-[58px] rounded-2xl bg-slate-100 dark:bg-night-800 animate-pulse" />;
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
