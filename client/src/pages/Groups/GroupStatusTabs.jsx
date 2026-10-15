import { useTranslation } from "react-i18next";

const OPTIONS = [
  { value: "", labelKey: "common.all" },
  { value: "active", labelKey: "group.statusActive" },
  { value: "pending", labelKey: "group.statusPending" },
  { value: "finished", labelKey: "group.statusFinished" },
];

/**
 * `/groups` holat filtri — Select o'rniga doim ko'rinib turadigan tablar.
 * Son faqat tanlangan tabda (`meta.total`) — boshqa holatlar soni uchun
 * alohida so'rov yuborilmaydi.
 *
 * @param {Object} props
 * @param {string} props.value - "" | "active" | "pending" | "finished"
 * @param {(value: string) => void} props.onChange
 * @param {number} [props.count] - tanlangan tabdagi guruhlar soni
 */
function GroupStatusTabs({ value, onChange, count }) {
  const { t } = useTranslation();

  return (
    <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div role="tablist" className="flex items-center gap-1 w-max">
        {OPTIONS.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value || "all"}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(o.value)}
              className={`inline-flex items-center gap-2 h-9 px-3 shrink-0 whitespace-nowrap rounded-xl text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
                on
                  ? "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-night-800"
              }`}
            >
              {t(o.labelKey)}
              {on && count != null && (
                <span className="min-w-5 h-5 px-1.5 rounded-md bg-white dark:bg-night-900 text-[11px] font-jet font-semibold tabular-nums flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default GroupStatusTabs;
