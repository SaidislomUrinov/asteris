import { useEffect, useRef } from "react";

/**
 * Guruh detali (`/groups/:id`, `/lesson`) bo'limlari tab qatori —
 * O'quvchilar · Davomat · Baholar · Uyga vazifa · Reja. Ikonka + yozuv,
 * faol tab ko'k "tabletka" bilan ajraladi; telefonda qator gorizontal suriladi.
 *
 * @param {Object} props
 * @param {{ key: string, label: string, icon?: import("react").ComponentType }[]} props.tabs
 * @param {string} props.active
 * @param {(key: string) => void} props.onChange
 */
function GroupSectionTabs({ tabs, active, onChange }) {
  const activeRef = useRef(null);

  // Faqat tab o'zgarganda: faol tab ekrandan tashqarida bo'lsa suriladi.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <div className="max-w-full overflow-x-auto self-start shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        role="tablist"
        className="flex items-center gap-1 p-1 rounded-2xl w-max bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none"
      >
        {tabs.map(({ key, label, icon: TabIcon }) => {
          const on = active === key;
          return (
            <button
              key={key}
              ref={on ? activeRef : null}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(key)}
              className={`inline-flex items-center gap-2 h-9 px-3.5 max-sm:px-3 shrink-0 whitespace-nowrap rounded-xl text-sm font-semibold cursor-pointer transition-colors duration-150 ${
                on
                  ? "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-night-800"
              }`}
            >
              {TabIcon && (
                <TabIcon
                  className={`text-base shrink-0 ${on ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}
                />
              )}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default GroupSectionTabs;
