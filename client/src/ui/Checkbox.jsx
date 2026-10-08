/**
 * Checkbox component
 *
 * @param {Object} props
 * @param {boolean} [props.checked=false] - Checkbox holati
 * @param {(checked: boolean) => void} [props.onChange] - Holat o'zgarganda chaqiriladi
 * @param {string} [props.label] - Checkbox yonidagi matn
 * @param {"emerald"|"blue"|"black"|"slate"|"red"|"orange"|"yellow"} [props.color="blue"] - Checkbox rangi
 * @param {"circle"|"square"} [props.variant="circle"] - Checkbox shakli
 * @param {boolean} [props.disabled=false] - Disabled holati
 * @param {string} [props.className] - Qo'shimcha className
 * @returns {JSX.Element}
 */
function Checkbox({
  checked = false,
  onChange = () => {},
  label = "",
  color = "blue",
  variant = "circle",
  disabled = false,
  className = "",
}) {
  const checkedBg = {
    emerald: "bg-emerald-500 border-emerald-500 shadow-[0_1px_3px_rgba(16,185,129,0.4)]",
    blue:    "bg-blue-500 border-blue-500 shadow-[0_1px_3px_rgba(59,130,246,0.4)]",
    black:   "bg-slate-900 border-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.35)]",
    red:     "bg-red-500 border-red-500 shadow-[0_1px_3px_rgba(239,68,68,0.4)]",
    orange:  "bg-orange-500 border-orange-500 shadow-[0_1px_3px_rgba(249,115,22,0.4)]",
    yellow:  "bg-yellow-400 border-yellow-400 shadow-[0_1px_3px_rgba(250,204,21,0.45)]",
    slate:   "bg-slate-700 border-slate-700 shadow-[0_1px_3px_rgba(51,65,85,0.35)]",
  };

  // Belgilanmagan katak NEYTRAL chegara bilan oq fonda chiziladi — rangli
  // (masalan `blue-400`) och chegara ko'zga tashlanmasdi va foydalanuvchi
  // katak borligini umuman payqamay qolardi. Neytral kulrang chegara uni
  // "bo'sh quti" bo'lib ko'rsatadi, hover'da esa komponentning o'z rangiga
  // o'tadi.
  const uncheckedHover = {
    emerald: "hover:border-emerald-500",
    blue:    "hover:border-blue-500",
    black:   "hover:border-black",
    red:     "hover:border-red-500",
    orange:  "hover:border-orange-500",
    yellow:  "hover:border-yellow-500",
    slate:   "hover:border-slate-700",
  };
  const uncheckedBase = "bg-white dark:bg-night-900 border-slate-300 dark:border-night-600";

  const shape = variant === "circle" ? "rounded-full" : "rounded-md";

  return (
    <label
      className={`inline-flex items-center gap-2 ${disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer"} ${className}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative flex items-center justify-center shrink-0
          w-5 h-5 border-[1.5px]
          transition-all duration-200
          ${shape}
          ${checked ? checkedBg[color] : `${uncheckedBase} shadow-[0_1px_1px_rgba(15,23,42,0.04)] ${disabled ? "" : uncheckedHover[color]}`}
          ${disabled ? "cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        {/* Belgi — nuqta emas, haqiqiy "check" ishorasi: nima qilinganini
            (tanlandi) bir qarashda o'qitadi va yorliq matni bilan bir tilda. */}
        {checked && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3 h-3 text-white"
          >
            <path d="m5 13 4 4L19 7" />
          </svg>
        )}
      </button>
      {label && (
        <span className="text-[13px] text-slate-700 dark:text-slate-300 select-none">{label}</span>
      )}
    </label>
  );
}

export default Checkbox;
