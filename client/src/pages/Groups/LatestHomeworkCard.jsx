import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronRight, HiClipboardDocumentList } from "react-icons/hi2";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";

// "YYYY-MM-DD" → "13.10.2026"
const fmtDay = (d) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : "");

/**
 * Guruh detali — guruh ma'lumotlari ostidagi "Oxirgi vazifa" kartasi
 * (docs/API_CONTRACT_group_latest_homework.md). Bosilsa "Uyga vazifa" tabi.
 * Boshqa xodim vazifa yozsa (`homework:updated`) qayta so'raladi.
 *
 * @param {Object} props
 * @param {string} props.groupId
 * @param {() => void} props.onOpen
 */
function LatestHomeworkCard({ groupId, onOpen }) {
  const { t } = useTranslation();
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

  useSocketEvent(
    "homework:updated",
    (p) => {
      if (p?.groupId === groupId) load();
    },
    !!groupId,
  );

  if (!loaded) {
    return <div className="h-[58px] max-sm:h-[52px] shrink-0 rounded-2xl bg-slate-100 dark:bg-night-800 animate-pulse" />;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative overflow-hidden flex items-center gap-2.5 w-full shrink-0 p-3 pl-4 max-sm:p-2.5 max-sm:pl-3.5 rounded-2xl text-left bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none hover:border-amber-300 dark:hover:border-amber-500/40 cursor-pointer transition-colors"
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-amber-400" />
      <span className="flex items-center justify-center w-8 h-8 max-sm:hidden shrink-0 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-500 text-base">
        <HiClipboardDocumentList />
      </span>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
            {t("homework.latest")}
          </span>
          {item && (
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
              {fmtDay(item.date)}
            </span>
          )}
        </div>
        {item ? (
          <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-line break-words line-clamp-2">
            {item.text}
          </p>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">{t("homework.latestEmpty")}</p>
        )}
      </div>
      <HiChevronRight className="text-lg shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-amber-500 transition-colors" />
    </button>
  );
}

export default LatestHomeworkCard;
