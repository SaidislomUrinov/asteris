import { cn } from "../utils/cn";

// 3 ta statistik karta bir qatorda. items: [{ value, label, tone, icon }]
const TONE = {
  ok: "text-ok",
  bad: "text-bad",
  warn: "text-warn",
};
const ICON_TONE = {
  ok: "bg-ok-bg text-ok",
  bad: "bg-bad-bg text-bad",
  warn: "bg-warn-bg text-warn",
  default: "bg-accent/10 text-accent",
};

export const StatRow = ({ items, className, dark }) => (
  <div className={cn("grid grid-cols-3 gap-2", className)}>
    {items.map((it, i) => {
      const Ic = it.icon;
      return (
        <div
          key={i}
          className={cn(
            "rounded-2xl px-2.5 py-3 min-w-0 flex flex-col gap-1.5",
            dark ? "bg-white/8" : "bg-card border border-line/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
          )}
        >
          {Ic && (
            <span className={cn("w-7 h-7 rounded-lg grid place-items-center", dark ? "bg-white/10 text-hero-fg" : ICON_TONE[it.tone] || ICON_TONE.default)}>
              <Ic className="w-4 h-4" />
            </span>
          )}
          <div className={cn("font-extrabold tabular leading-tight whitespace-nowrap", String(it.value).length > 6 ? "text-[15px]" : "text-[17px]", !dark && TONE[it.tone])}>
            {it.value}
            {it.suffix && <span className="font-sans font-bold text-[10px] ml-0.5 opacity-80">{it.suffix}</span>}
          </div>
          <div className={cn("text-[11px] leading-tight -mt-1", dark ? "text-hero-fg-mut" : "text-hint")}>{it.label}</div>
        </div>
      );
    })}
  </div>
);
