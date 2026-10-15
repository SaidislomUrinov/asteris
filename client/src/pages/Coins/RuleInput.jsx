import CoinIcon from "../../ui/CoinIcon";

/**
 * Bitta qoida katagi — yorliq + tanga soni (0..1000).
 *
 * @param {Object} props
 * @param {React.ReactNode} props.label
 * @param {number} props.value
 * @param {(v: number) => void} props.onChange
 * @param {boolean} [props.disabled]
 */
function RuleInput({ label, value, onChange, disabled = false }) {
  const active = Number(value) > 0;
  return (
    <label
      className={`flex flex-col gap-1.5 p-2.5 rounded-xl border transition-colors ${
        active
          ? "border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10"
          : "border-slate-200 dark:border-night-700 bg-white dark:bg-night-900"
      }`}
    >
      <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 truncate">{label}</span>
      <span className="flex items-center gap-1.5">
        <CoinIcon size={16} className={active ? "" : "grayscale opacity-50"} />
        <input
          type="tel"
          inputMode="numeric"
          disabled={disabled}
          value={value ? String(value) : ""}
          placeholder="0"
          onChange={(e) => onChange(Math.min(1000, Number(e.target.value.replace(/\D/g, "").slice(0, 4)) || 0))}
          className="w-full min-w-0 bg-transparent outline-none text-base font-bold tabular-nums text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 disabled:cursor-not-allowed"
        />
      </span>
    </label>
  );
}

export default RuleInput;
