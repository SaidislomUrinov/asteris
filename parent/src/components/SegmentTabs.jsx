import { cn } from "../utils/cn";

export const SegmentTabs = ({ items, value, onChange, className }) => (
  <div className={cn("flex gap-1 bg-ink/6 p-1 rounded-xl", className)}>
    {items.map((it) => (
      <button
        key={it.value}
        type="button"
        onClick={() => onChange(it.value)}
        className={cn(
          "flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[13px] font-bold transition-colors break-words",
          value === it.value ? "bg-card text-ink shadow-[0_1px_3px_rgba(15,23,42,0.10)]" : "text-hint",
        )}
      >
        {it.label}
      </button>
    ))}
  </div>
);
