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
      black: "bg-slate-900 text-white hover:bg-slate-800 shadow-[0_4px_12px_-4px_rgba(15,23,42,0.45)]",
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
      emerald: "bg-white border border-slate-200 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      blue: "bg-white border border-slate-200 text-blue-600 hover:border-blue-300 hover:bg-blue-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      violet: "bg-white border border-slate-200 text-violet-600 hover:border-violet-300 hover:bg-violet-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      black: "bg-white border border-slate-200 text-slate-900 hover:border-slate-400 hover:bg-slate-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      red: "bg-white border border-slate-200 text-red-600 hover:border-red-300 hover:bg-red-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      orange: "bg-white border border-slate-200 text-orange-600 hover:border-orange-300 hover:bg-orange-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      yellow: "bg-white border border-slate-200 text-yellow-700 hover:border-yellow-300 hover:bg-yellow-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      cyan: "bg-white border border-slate-200 text-cyan-600 hover:border-cyan-300 hover:bg-cyan-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      zinc: "bg-white border border-slate-200 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      slate: "bg-white border border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    },

    ghost: {
      emerald: "text-emerald-600 bg-emerald-50 hover:bg-emerald-100",
      blue: "text-blue-600 bg-blue-50 hover:bg-blue-100",
      violet: "text-violet-600 bg-violet-50 hover:bg-violet-100",
      black: "text-slate-900 bg-slate-100 hover:bg-slate-200",
      red: "text-red-600 bg-red-50 hover:bg-red-100",
      orange: "text-orange-600 bg-orange-50 hover:bg-orange-100",
      yellow: "text-yellow-700 bg-yellow-50 hover:bg-yellow-100",
      cyan: "text-cyan-600 bg-cyan-50 hover:bg-cyan-100",
      zinc: "text-zinc-600 bg-zinc-100 hover:bg-zinc-200",
      slate: "text-slate-700 bg-slate-100 hover:bg-slate-200",
    },

    text: {
      emerald: "text-emerald-600 px-2.5 hover:bg-emerald-50",
      blue: "text-blue-600 px-2.5 hover:bg-blue-50",
      violet: "text-violet-600 px-2.5 hover:bg-violet-50",
      black: "text-slate-900 px-2.5 hover:bg-slate-100",
      red: "text-red-600 px-2.5 hover:bg-red-50",
      orange: "text-orange-600 px-2.5 hover:bg-orange-50",
      yellow: "text-yellow-700 px-2.5 hover:bg-yellow-50",
      cyan: "text-cyan-600 px-2.5 hover:bg-cyan-50",
      zinc: "text-zinc-600 px-2.5 hover:bg-zinc-100",
      slate: "text-slate-700 px-2.5 hover:bg-slate-100",
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
