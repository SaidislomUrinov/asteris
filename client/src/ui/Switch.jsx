/**
 * Switch component
 *
 * @param {Object} props
 * @param {boolean} [props.checked=false] - Switch holati
 * @param {(checked: boolean) => void} [props.onChange] - Switch o'zgarganda chaqiriladigan funksiya
 * @param {"emerald"|"blue"|"red"|"yellow"|"orange"|"black"|"slate"} [props.color="blue"] - Switch rangi
 * @param {boolean} [props.disabled=false] - Switch disabled holatda
 * @param {string} [props.label] - Switch yonidagi matn
 * @param {string} [props.className] - Qo'shimcha class
 * @returns {JSX.Element}
 */
function Switch({
  checked = false,
  onChange = () => {},
  color = "blue",
  disabled = false,
  label = "",
  className = "",
}) {
  // Yoqilgan holatdagi fon + fokus halqasi. Halqa Select/Input bilan bir xil
  // formulada (`ring-3` + rangning 15% shaffofligi).
  const colors = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    red: "bg-rose-500",
    yellow: "bg-amber-500",
    orange: "bg-orange-500",
    black: "bg-slate-900",
    slate: "bg-slate-700",
  };

  // To'liq klass yoziladi — Tailwind manbani statik skanerlaydi, prefiksni
  // runtime'da yopishtirsak (`focus-visible:${...}`) klass generatsiya bo'lmaydi.
  const rings = {
    emerald: "focus-visible:ring-3 focus-visible:ring-emerald-500/20",
    blue: "focus-visible:ring-3 focus-visible:ring-blue-500/20",
    red: "focus-visible:ring-3 focus-visible:ring-rose-500/20",
    yellow: "focus-visible:ring-3 focus-visible:ring-amber-500/20",
    orange: "focus-visible:ring-3 focus-visible:ring-orange-500/20",
    black: "focus-visible:ring-3 focus-visible:ring-slate-900/15",
    slate: "focus-visible:ring-3 focus-visible:ring-slate-500/20",
  };

  return (
    <label
      className={`inline-flex items-center gap-2 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${className}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex shrink-0 items-center h-6 w-11 p-0.5 rounded-full border transition-colors duration-200 outline-none ${
          checked
            ? `${colors[color]} border-transparent`
            : "bg-slate-200 dark:bg-night-700 border-slate-300/60 dark:border-night-600/60 hover:bg-slate-300/70 dark:hover:bg-night-600/70"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"} ${rings[color]}`}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.25)] dark:shadow-none transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      {label && (
        <span className="text-[13px] text-slate-700 dark:text-slate-300 select-none">{label}</span>
      )}
    </label>
  );
}

export default Switch;
