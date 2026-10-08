/**
 * Badge component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Badge o'ralgan element (Button, IconButton, va h.k.)
 * @param {number} [props.value] - Badge ichidagi raqam
 * @param {"emerald"|"blue"|"black"|"red"|"orange"|"yellow"} [props.color="red"] - Badge rangi
 * @param {"filled"|"ghost"|"outlined"} [props.variant="filled"] - Badge varianti
 * @param {string} [props.className] - Qo'shimcha className
 * @returns {JSX.Element}
 */
function Badge({
  children,
  value,
  color = "red",
  variant = "filled",
  className = "",
}) {
  const variants = {
    filled: {
      emerald: "bg-emerald-500 text-white",
      blue: "bg-blue-500 text-white",
      black: "bg-black text-white",
      red: "bg-red-500 text-white",
      orange: "bg-orange-500 text-white",
      yellow: "bg-yellow-400 text-black",
      slate: "bg-slate-700 text-white",
    },
    ghost: {
      emerald: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      blue: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
      black: "bg-zinc-200 dark:bg-night-700 text-black dark:text-slate-100",
      red: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
      orange: "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400",
      yellow: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
      slate: "bg-slate-100 dark:bg-night-800 text-slate-700 dark:text-slate-300",
    },
    outlined: {
      emerald: "bg-white dark:bg-night-900 border border-emerald-500 text-emerald-600 dark:text-emerald-400",
      blue: "bg-white dark:bg-night-900 border border-blue-500 text-blue-600 dark:text-blue-400",
      black: "bg-white dark:bg-night-900 border border-black text-black dark:text-slate-100",
      red: "bg-white dark:bg-night-900 border border-red-500 text-red-600 dark:text-red-400",
      orange: "bg-white dark:bg-night-900 border border-orange-500 text-orange-600 dark:text-orange-400",
      yellow: "bg-white dark:bg-night-900 border border-yellow-400 text-yellow-700 dark:text-yellow-400",
      slate: "bg-white dark:bg-night-900 border border-slate-500 text-slate-700 dark:text-slate-300",
    },
  };

  const display =
    value === undefined ? null : value > 99 ? "99+" : String(value);
  const isWide = display && display.length > 1;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {children}
      {display !== null && (
        <span
          className={`
            absolute -top-1.5 -right-1.5
            flex items-center justify-center
            min-w-4.5 h-4.5
            ${isWide ? "px-1 rounded-full" : "rounded-full"}
            text-[10px] font-bold leading-none select-none
            ${variants[variant][color]}
          `}
        >
          {display}
        </span>
      )}
    </div>
  );
}

export default Badge;
