import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";

// Shu oyning dars kunlari — gorizontal chiplar (`GET /attendance/:id/month`
// `days`). Tanlangan — to'q, bugun — accent ramka + nuqta, dam olish kuni
// binafsha, kelajak/ko'chirilgan (qulf) kunlar xira.
export const DateStrip = ({ days, value, today, onChange }) => {
  const { t } = useTranslation();
  const ref = useRef(null);

  // Tanlangan kun ko'rinib tursin.
  useEffect(() => {
    const el = ref.current?.querySelector(`[data-date="${value}"]`);
    el?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [value, days]);

  return (
    <div ref={ref} className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 scroll-px-4 py-0.5">
      {days.map((d) => {
        const active = d.date === value;
        const isToday = d.date === today;
        const locked = !active && (d.future || d.transferred);
        return (
          <button
            key={d.date}
            type="button"
            data-date={d.date}
            onClick={() => onChange(d.date)}
            className={cn(
              "relative shrink-0 w-12 h-14 rounded-xl border flex flex-col items-center justify-center transition-colors active:opacity-80",
              active
                ? "bg-ink text-bg border-ink shadow-[0_1px_2px_rgba(15,23,42,0.12)]"
                : d.holiday
                  ? "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-300"
                  : isToday
                    ? "bg-card border-accent border-2 text-ink"
                    : "bg-card border-line/70 text-ink",
              locked && "opacity-40",
            )}
          >
            <span className="text-[10px] font-bold uppercase leading-tight opacity-75">{t(`days.${d.day}`)}</span>
            <span className="tabular text-[15px] font-bold leading-tight">{Number(d.date.slice(8, 10))}</span>
            {isToday && <span className={cn("absolute bottom-1 w-1 h-1 rounded-full", active ? "bg-bg" : "bg-accent")} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
};
