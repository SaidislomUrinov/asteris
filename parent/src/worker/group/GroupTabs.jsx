import { useEffect, useRef } from "react";
import { cn } from "../../utils/cn";

// Guruh detali tablari — gorizontal skroll, sticky emas (details §6).
// Faol tab to'q (ink) to'ldirilgan, qolganlari chegarali.
// Faol tab gorizontal ko'rinish maydoniga suriladi — oxirgi tab ("Uyga vazifa")
// tanlanganda o'ng chetda yarmi kesilib qolardi. Faqat konteyner suriladi,
// sahifa vertikal siljimaydi (scrollIntoView'dan farqli).
export const GroupTabs = ({ items, value, onChange }) => {
  const ref = useRef(null);
  useEffect(() => {
    const box = ref.current;
    const tab = box?.querySelector('[aria-selected="true"]');
    if (!tab) return;
    const pad = 16;
    if (tab.offsetLeft + tab.offsetWidth > box.scrollLeft + box.clientWidth - pad) {
      box.scrollLeft = tab.offsetLeft + tab.offsetWidth - box.clientWidth + pad;
    } else if (tab.offsetLeft < box.scrollLeft + pad) {
      box.scrollLeft = tab.offsetLeft - pad;
    }
  }, [value]);

  return (
    <div ref={ref} className="relative flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 scroll-px-4 py-0.5" role="tablist">
      {items.map((it) => {
        const on = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.key)}
            className={cn(
              "shrink-0 px-4 h-10 rounded-full text-[13.5px] font-bold border whitespace-nowrap transition-colors active:opacity-80",
              on
                ? "bg-ink text-bg border-ink shadow-[0_1px_2px_rgba(15,23,42,0.12)]"
                : "bg-card text-hint border-line/70",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
};
