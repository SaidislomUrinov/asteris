import { cn } from "../utils/cn";

export const Switch = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative w-11 h-6.5 rounded-full shrink-0 transition-colors disabled:opacity-50",
      checked ? "bg-ok" : "bg-hint/40",
    )}
  >
    <span
      className={cn(
        "absolute top-0.5 left-0.5 w-5.5 h-5.5 rounded-full bg-white shadow transition-transform",
        checked && "translate-x-[18px]",
      )}
    />
  </button>
);
