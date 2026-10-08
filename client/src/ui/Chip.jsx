/**
 * Chip component
 *
 * @param {Object} props
 * @param {string} props.value - Chip ichidagi text
 * @param {"emerald"|"blue"|"violet"|"black"|"slate"|"red"|"orange"|"yellow"} [props.color="blue"] - Chip rangi
 * @param {"filled"|"ghost"|"text"|"outlined"|"gradient"} [props.variant="ghost"] - Chip varianti
 * @param {string} [props.className] - Qo‘shimcha className
 * @returns {JSX.Element}
 */
function Chip({
  value,
  color = "blue",
  variant = "ghost",
  className = "",
}) {
  const base =
    "inline-flex select-none items-center justify-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold uppercase";

  const variants = {
    filled: {
      emerald: "bg-emerald-500 text-white",
      blue: "bg-blue-500 text-white",
      violet: "bg-violet-500 text-white",
      black: "bg-black text-white",
      red: "bg-red-500 text-white",
      orange: "bg-orange-500 text-white",
      yellow: "bg-yellow-500 text-black",
      slate: "bg-slate-700 text-white",
    },
    outlined: {
      emerald: "border border-emerald-500 text-emerald-500",
      blue: "border border-blue-500 text-blue-500",
      violet: "border border-violet-500 text-violet-500",
      black: "border border-black dark:border-slate-400 text-black dark:text-slate-100",
      red: "border border-red-500 text-red-500",
      orange: "border border-orange-500 text-orange-500",
      yellow: "border border-yellow-500 text-yellow-500",
      slate: "border border-slate-500 text-slate-600 dark:text-slate-300",
    },
    ghost: {
      emerald: "text-emerald-500 bg-emerald-100 dark:bg-emerald-500/20",
      blue: "text-blue-500 bg-blue-100 dark:bg-blue-500/20",
      violet: "text-violet-500 bg-violet-100 dark:bg-violet-500/20",
      black: "text-black dark:text-slate-100 bg-gray-100 dark:bg-night-800",
      red: "text-red-500 bg-red-100 dark:bg-red-500/20",
      orange: "text-orange-500 bg-orange-100 dark:bg-orange-500/20",
      yellow: "text-yellow-500 bg-yellow-100 dark:bg-yellow-500/20",
      slate: "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-night-800",
    },
    text: {
      emerald: "text-emerald-500",
      blue: "text-blue-500",
      violet: "text-violet-500",
      black: "text-black dark:text-slate-100",
      red: "text-red-500",
      orange: "text-orange-500",
      yellow: "text-yellow-500",
      slate: "text-slate-600 dark:text-slate-300",
    },
    gradient: {
      emerald: "bg-gradient-to-br from-emerald-400 to-emerald-800 text-white",
      blue: "bg-gradient-to-br from-blue-400 to-blue-800 text-white",
      violet: "bg-gradient-to-br from-violet-400 to-violet-800 text-white",
      black: "bg-gradient-to-br from-zinc-600 to-black text-white",
      red: "bg-gradient-to-br from-red-400 to-red-800 text-white",
      orange: "bg-gradient-to-br from-orange-400 to-orange-800 text-white",
      yellow: "bg-gradient-to-br from-yellow-300 to-yellow-600 text-black",
      slate: "bg-gradient-to-br from-slate-700 to-slate-900 text-white",
    },
  };

  return (
    <div className={`${base} ${variants[variant][color]} ${className}`}>
      {value}
    </div>
  );
}

export default Chip;
