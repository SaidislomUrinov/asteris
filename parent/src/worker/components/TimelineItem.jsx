import { cn } from "../../utils/cn";

const DOT = {
  ok: "border-ok",
  bad: "border-bad",
  warn: "border-warn",
  acc: "border-accent",
  mut: "border-line",
};

// Lentadagi bitta voqea: o'tgani xira, hozirgisi accent halqa bilan.
// Bosiladigan karta `div role="button"` — ichida MiniAction tugmasi bo'lgani
// uchun (button ichida button — noto'g'ri HTML).
export const TimelineItem = ({ time, state, dot = "mut", onClick, children }) => {
  const clickable = onClick
    ? {
        role: "button",
        tabIndex: 0,
        onClick,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};
  return (
    <div className={cn("grid grid-cols-[44px_16px_minmax(0,1fr)] items-start", state === "past" && "opacity-60")}>
      <span className="tabular text-[12px] font-bold text-hint pt-2.5">{time}</span>
      <span
        className={cn(
          "relative z-[1] w-3 h-3 mt-3 ml-0.5 rounded-full bg-card border-[2.5px]",
          DOT[state === "now" ? "acc" : dot],
        )}
        aria-hidden="true"
      />
      <div
        {...clickable}
        className={cn(
          "ml-1.5 bg-card rounded-2xl px-3 py-2.5 min-w-0 text-left border border-line/70",
          state === "now" && "ring-2 ring-accent ring-inset border-transparent",
          onClick && "active:opacity-80 transition-opacity cursor-pointer",
        )}
      >
        {children}
      </div>
    </div>
  );
};
