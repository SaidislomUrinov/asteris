/**
 * Switch component
 *
 * @param {Object} props
 * @param {boolean} [props.checked=false] - Switch holati
 * @param {(checked: boolean) => void} [props.onChange] - Switch o'zgarganda chaqiriladigan funksiya
 * @param {"emerald"|"blue"|"red"|"yellow"|"orange"|"black"|"slate"} [props.color="slate"] - Switch rangi
 * @param {boolean} [props.disabled=false] - Switch disabled holatda
 * @param {string} [props.label] - Switch yonidagi matn
 * @param {string} [props.className] - Qo'shimcha class
 * @returns {JSX.Element}
 */
function Switch({
  checked = false,
  onChange = () => {},
  color = "slate",
  disabled = false,
  label = "",
  className = "",
}) {
  const colors = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    red: "bg-red-500",
    yellow: "bg-yellow-500",
    orange: "bg-orange-500",
    black: "bg-black",
    slate: "bg-slate-700",
  };

  return (
    <label
      className={`inline-flex items-center gap-2 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${className}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-300
          ${checked ? colors[color] : "bg-gray-300"}
          ${disabled ? "cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <span
          className={`
             flex items-center justify-center w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-300
            ${checked ? "translate-x-5.5" : "translate-x-0.5"}
          `}
        >
          <div
            className={`${checked ? `${colors[color]} w-1` : "bg-zinc-300 -rotate-90 w-2.5"} duration-300 h-2.5 rounded-full`}
          ></div>
        </span>
      </button>
      {label && (
        <span className="text-sm text-slate-800 select-none">{label}</span>
      )}
    </label>
  );
}

export default Switch;
