import { createElement } from "react";
import { cn } from "../../utils/cn";

// Profil kartasidagi amal tugmasi (Qo'ng'iroq, To'lov).
export const ActionChip = ({ icon, children, onClick, primary, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    aria-disabled={disabled || undefined}
    className={cn(
      "inline-flex items-center justify-center gap-1.5 px-3 h-10 rounded-xl text-[13px] font-bold active:opacity-70 min-w-0 flex-1 basis-[130px]",
      primary ? "bg-accent text-accent-fg" : "bg-accent/10 text-accent",
      disabled && "opacity-50",
    )}
  >
    {createElement(icon, { className: "w-4 h-4 shrink-0" })}
    <span className="truncate">{children}</span>
  </button>
);
