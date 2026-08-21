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
    emerald: "bg-emerald-500 border-emerald-500",
    blue:    "bg-blue-500 border-blue-500",
    black:   "bg-black border-black",
    red:     "bg-red-500 border-red-500",
    orange:  "bg-orange-500 border-orange-500",
    yellow:  "bg-yellow-400 border-yellow-400",
    slate:   "bg-slate-700 border-slate-700",
  };

  // Belgilanmagan katak NEYTRAL va to'q chegara bilan chiziladi — rangli
  // (masalan `blue-400`) och chegara oq fonda ko'zga tashlanmasdi va
  // foydalanuvchi katak borligini umuman payqamay qolardi. Neytral kulrang
  // + ichki och fon uni "bo'sh quti" bo'lib ko'rsatadi, hover'da esa
  // komponentning o'z rangiga o'tadi.
  const uncheckedHover = {
    emerald: "hover:border-emerald-500",
    blue:    "hover:border-blue-500",
    black:   "hover:border-black",
    red:     "hover:border-red-500",
    orange:  "hover:border-orange-500",
    yellow:  "hover:border-yellow-500",
    slate:   "hover:border-slate-700",
  };
  const uncheckedBase = "bg-slate-50 border-slate-400";

  const shape = variant === "circle" ? "rounded-full" : "rounded-md";
  const innerShape = variant === "circle" ? "rounded-full" : "rounded-sm";

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
          w-5 h-5 border-2 shadow-[0_1px_1px_rgba(15,23,42,0.06)]
          transition-all duration-200
          ${shape}
          ${checked ? checkedBg[color] : `${uncheckedBase} ${disabled ? "" : uncheckedHover[color]}`}
          ${disabled ? "cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        {checked && (
          <div className={`bg-white w-2 h-2 ${innerShape} transition-all duration-200`} />
        )}
      </button>
      {label && (
        <span className="text-sm text-slate-800 select-none">{label}</span>
      )}
    </label>
  );
}

export default Checkbox;
