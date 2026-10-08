import { createElement } from "react";
import { HiChevronRight } from "react-icons/hi2";
import { cn } from "../../utils/cn";

// "Menyu" sahifasidagi bitta band: ikonka, nom, ixtiyoriy belgi (badge).
export const MenuItem = ({ icon, label, hint, badge, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-disabled={disabled || undefined}
    className={cn("w-full flex items-center gap-3 py-2.5 min-h-14 text-left", disabled ? "cursor-not-allowed" : "active:opacity-70")}
  >
    <span className={cn("w-10 h-10 rounded-xl bg-ink/6 text-ink grid place-items-center shrink-0", disabled && "opacity-45")}>
      {createElement(icon, { className: "w-5 h-5" })}
    </span>
    <span className="min-w-0 flex-1">
      <span className={cn("block font-bold text-[15px] leading-tight truncate", disabled && "text-hint")}>{label}</span>
      {hint && <span className={cn("block text-[12.5px] leading-snug text-hint mt-0.5", !disabled && "truncate")}>{hint}</span>}
    </span>
    {badge != null && (
      <span className="min-w-5 h-5 px-1.5 rounded-full bg-bad text-white text-[11px] leading-5 font-extrabold tabular text-center">
        {badge}
      </span>
    )}
    <HiChevronRight className="w-4 h-4 text-hint/70 shrink-0" />
  </button>
);
