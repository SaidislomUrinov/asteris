import { CgSpinner } from "react-icons/cg";

/**
 * Button component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button ichidagi kontent (text, icon, etc)
 * @param {boolean} [props.disabled=false] - Button o‘chiqmi yo‘qmi
 * @param {boolean} [props.loading=false] - Loader ko‘rsatish holati
 * @param {"emerald"|"blue"|"violet"|"black"|"slate"|"red"|"orange"|"yellow"} [props.color="blue"] - Button rangi
 * @param {"filled"|"ghost"|"text"|"outlined"|"gradient"} [props.variant="filled"] - Button varianti
 * @param {string} [props.className] - Button uchun qo'shimcha class
 * @param {boolean} [props.fullWith] - Button withd
 * @param {(event: React.MouseEvent<HTMLButtonElement>) => void} [props.onClick] - Button onClick
 * @returns {JSX.Element}
 */
function Button({
  children,
  disabled = false,
  loading = false,
  color = "blue",
  variant = "filled",
  className = "",
  fullWith = false,
  onClick = () => {},
  ...props
}) {
  // `shrink-0 whitespace-nowrap` — max-h-10 qat'iy balandlikni belgilaydi,
  // shuning uchun matn ikki qatorga tushib qolsa pastki yarmi kesilib
  // ko'rinardi (torg'in flex qatorda bir nechta tugma sig'dirilganda —
  // masalan "VIDEO DARSLIK" ikki so'zga bo'linib ketardi). Endi tugma hech
  // qachon o'z tarkibidagi matnni bukmaydi — joy yetmasa ota flex qator
  // (agar `flex-wrap` bo'lsa) o'zi keyingi qatorga o'tkazadi.
  // `shrink-0 whitespace-nowrap` — max-h qat'iy balandlikni belgilaydi,
  // shuning uchun matn ikki qatorga tushib qolsa pastki yarmi kesilib
  // ko'rinardi (torg'in flex qatorda bir nechta tugma sig'dirilganda —
  // masalan "VIDEO DARSLIK" ikki so'zga bo'linib ketardi). Endi tugma hech
  // qachon o'z tarkibidagi matnni bukmaydi — joy yetmasa ota flex qator
  // (agar `flex-wrap` bo'lsa) o'zi keyingi qatorga o'tkazadi.
  //
  // Matn CAPS emas: 15px (`text-[13px]`) sentence-case yorliq uzun
  // so'zlarda ("O'quvchi qo'shish") ancha tez o'qiladi va maydonlar bilan
  // bir tipografik shkalada turadi.
  const base =
    "inline-flex shrink-0 whitespace-nowrap select-none relative items-center cursor-pointer justify-center gap-2 px-5 max-h-11 min-h-11 rounded-xl text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 active:scale-95 disabled:active:scale-100 duration-200";

  const variants = {
    filled: {
      emerald: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.5)]",
      blue: "bg-blue-500 text-white hover:bg-blue-600 shadow-[0_4px_12px_-4px_rgba(59,130,246,0.5)]",
      violet: "bg-violet-500 text-white hover:bg-violet-600 shadow-[0_4px_12px_-4px_rgba(139,92,246,0.5)]",
      black: "bg-slate-900 text-white hover:bg-slate-800 shadow-[0_4px_12px_-4px_rgba(15,23,42,0.45)] dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:shadow-none",
      red: "bg-red-500 text-white hover:bg-red-600 shadow-[0_4px_12px_-4px_rgba(239,68,68,0.5)]",
      orange: "bg-orange-500 text-white hover:bg-orange-600 shadow-[0_4px_12px_-4px_rgba(249,115,22,0.5)]",
      yellow: "bg-yellow-500 text-black hover:bg-yellow-600 shadow-[0_4px_12px_-4px_rgba(234,179,8,0.5)]",
      cyan: "bg-cyan-500 text-white hover:bg-cyan-600 shadow-[0_4px_12px_-4px_rgba(6,182,212,0.5)]",
      zinc: "bg-zinc-500 text-white hover:bg-zinc-600 shadow-[0_4px_12px_-4px_rgba(113,113,122,0.5)]",
      slate: "bg-slate-700 text-white hover:bg-slate-800 shadow-[0_4px_12px_-4px_rgba(51,65,85,0.45)]",
    },

    // Ikkilamchi amal: oq yuza + yengil soya. Rangli chegara o'rniga neytral
    // chegara — "Bekor qilish" birlamchi tugma bilan raqobatlashmaydi, rang
    // esa faqat matnda qoladi.
    outlined: {
      emerald: "bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-emerald-600 dark:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
      blue: "bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-blue-600 dark:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/15 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
      violet: "bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-violet-600 dark:text-violet-400 hover:border-violet-300 dark:hover:border-violet-500/30 hover:bg-violet-50 dark:hover:bg-violet-500/15 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
      black: "bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-slate-900 dark:text-slate-100 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-night-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
      red: "bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-red-600 dark:text-red-400 hover:border-red-300 dark:hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/15 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
      orange: "bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-orange-600 dark:text-orange-400 hover:border-orange-300 dark:hover:border-orange-500/30 hover:bg-orange-50 dark:hover:bg-orange-500/15 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
      yellow: "bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-yellow-700 dark:text-yellow-400 hover:border-yellow-300 dark:hover:border-yellow-500/30 hover:bg-yellow-50 dark:hover:bg-yellow-500/15 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
      cyan: "bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-cyan-600 dark:text-cyan-400 hover:border-cyan-300 dark:hover:border-cyan-500/30 hover:bg-cyan-50 dark:hover:bg-cyan-500/15 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
      zinc: "bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-zinc-600 dark:text-slate-300 hover:border-zinc-400 hover:bg-zinc-50 dark:hover:bg-night-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
      slate: "bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-night-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none",
    },

    ghost: {
      emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25",
      blue: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25",
      violet: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/15 hover:bg-violet-100 dark:hover:bg-violet-500/25",
      black: "text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-night-800 hover:bg-slate-200 dark:hover:bg-night-600",
      red: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 hover:bg-red-100 dark:hover:bg-red-500/25",
      orange: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/15 hover:bg-orange-100 dark:hover:bg-orange-500/25",
      yellow: "text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/15 hover:bg-yellow-100 dark:hover:bg-yellow-500/25",
      cyan: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/15 hover:bg-cyan-100 dark:hover:bg-cyan-500/25",
      zinc: "text-zinc-600 dark:text-slate-300 bg-zinc-100 dark:bg-night-800 hover:bg-zinc-200 dark:hover:bg-night-600",
      slate: "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-night-800 hover:bg-slate-200 dark:hover:bg-night-600",
    },

    text: {
      emerald: "text-emerald-600 dark:text-emerald-400 px-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/15",
      blue: "text-blue-600 dark:text-blue-400 px-2.5 hover:bg-blue-50 dark:hover:bg-blue-500/15",
      violet: "text-violet-600 dark:text-violet-400 px-2.5 hover:bg-violet-50 dark:hover:bg-violet-500/15",
      black: "text-slate-900 dark:text-slate-100 px-2.5 hover:bg-slate-100 dark:hover:bg-night-700",
      red: "text-red-600 dark:text-red-400 px-2.5 hover:bg-red-50 dark:hover:bg-red-500/15",
      orange: "text-orange-600 dark:text-orange-400 px-2.5 hover:bg-orange-50 dark:hover:bg-orange-500/15",
      yellow: "text-yellow-700 dark:text-yellow-400 px-2.5 hover:bg-yellow-50 dark:hover:bg-yellow-500/15",
      cyan: "text-cyan-600 dark:text-cyan-400 px-2.5 hover:bg-cyan-50 dark:hover:bg-cyan-500/15",
      zinc: "text-zinc-600 dark:text-slate-300 px-2.5 hover:bg-zinc-100 dark:hover:bg-night-700",
      slate: "text-slate-700 dark:text-slate-300 px-2.5 hover:bg-slate-100 dark:hover:bg-night-700",
    },

    gradient: {
      emerald: "bg-gradient-to-br from-emerald-400 to-emerald-800 text-white hover:from-emerald-600 hover:to-emerald-800",
      blue: "bg-gradient-to-br from-blue-400 to-blue-800 text-white hover:from-blue-600 hover:to-blue-800",
      violet: "bg-gradient-to-br from-violet-400 to-violet-800 text-white hover:from-violet-600 hover:to-violet-800",
      black: "bg-gradient-to-br from-zinc-600 to-black text-white hover:from-black hover:to-zinc-900",
      red: "bg-gradient-to-br from-red-400 to-red-800 text-white hover:from-red-600 hover:to-red-800",
      orange: "bg-gradient-to-br from-orange-400 to-orange-800 text-white hover:from-orange-600 hover:to-orange-800",
      yellow: "bg-gradient-to-br from-yellow-300 to-yellow-600 text-black hover:from-yellow-500 hover:to-yellow-700",
      cyan: "bg-gradient-to-br from-cyan-400 to-cyan-800 text-white hover:from-cyan-600 hover:to-cyan-800",
      zinc: "bg-gradient-to-br from-zinc-400 to-zinc-700 text-white hover:from-zinc-600 hover:to-zinc-800",
      slate: "bg-gradient-to-br from-slate-700 to-slate-900 text-white hover:from-slate-800 hover:to-slate-950",
    },
  };

  return (
    <button
      {...props}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${base}
        ${variants[variant][color]}
        ${disabled || loading ? "cursor-not-allowed" : ""}
        ${className}
        ${fullWith ? "w-full" : ""}
      `}
    >
      {/* Spinner INLINE — avval `absolute right-1` edi va matn uzunroq bo'lsa
          uning ustiga tushib, ikkalasi ham o'qilmay qolardi. Endi u matndan
          oldin turadi va tugma tabiiy ravishda kengayadi. */}
      {loading && <CgSpinner className="animate-spin text-base shrink-0" />}
      {children}
    </button>
  );
}

export default Button;
