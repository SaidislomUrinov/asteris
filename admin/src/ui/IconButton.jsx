import { CgSpinner } from "react-icons/cg";

/**
 * Button component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button ichidagi kontent (text, icon, etc)
 * @param {boolean} [props.disabled=false] - Button o‘chiqmi yo‘qmi
 * @param {boolean} [props.loading=false] - Loader ko‘rsatish holati
 * @param {"emerald"|"blue"|"black"|"slate"|"red"|"orange"|"yellow"} [props.color="slate"] - Button rangi
 * @param {"filled"|"ghost"|"text"|"outlined"|"gradient"} [props.variant] - Button varianti
 * @param {string} [props.className] - Button uchun qo'shimcha class
 * @param {boolean} [props.fullWith] - Button withd
 * @param {(event: React.MouseEvent<HTMLButtonElement>) => void} [props.onClick] - Button onClick
 * @returns {JSX.Element}
 */
function IconButton({
  children,
  disabled = false,
  loading = false,
  color = "slate",
  variant = "gradient",
  className = "",
  fullWith = false,
  onClick = () => {},
  ...props
}) {
  const base =
    "inline-flex select-none relative items-center cursor-pointer justify-center gap-1 min-w-10 max-h-10 min-h-10 max-w-10 rounded-xl text-base font-semibold uppercase disabled:cursor-not-allowed disabled:opacity-50 active:scale-95 disabled:active:scale-100 duration-300";

  const variants = {
    filled: {
      emerald: "bg-emerald-500 text-white hover:bg-emerald-600",
      blue: "bg-blue-500 text-white hover:bg-blue-600",
      black: "bg-black text-white hover:bg-gray-800",
      red: "bg-red-500 text-white hover:bg-red-600",
      orange: "bg-orange-500 text-white hover:bg-orange-600",
      yellow: "bg-yellow-500 text-black hover:bg-yellow-600",
      slate: "bg-slate-700 text-white hover:bg-slate-800",
    },

    outlined: {
      emerald: "border border-emerald-500 text-emerald-500 hover:bg-emerald-50",
      blue: "border border-blue-500 text-blue-500 hover:bg-blue-50",
      black: "border border-black text-black hover:bg-gray-100",
      red: "border border-red-500 text-red-500 hover:bg-red-50",
      orange: "border border-orange-500 text-orange-500 hover:bg-orange-50",
      yellow: "border border-yellow-500 text-yellow-600 hover:bg-yellow-50",
      slate: "border border-slate-500 text-slate-600 hover:bg-slate-50",
    },

    ghost: {
      emerald: "text-emerald-500 bg-emerald-100 hover:bg-emerald-200",
      blue: "text-blue-500 bg-blue-100 hover:bg-blue-200",
      black: "text-black bg-gray-100 hover:bg-gray-200",
      red: "text-red-500 bg-red-100 hover:bg-red-200",
      orange: "text-orange-500 bg-orange-100 hover:bg-orange-200",
      yellow: "text-yellow-600 bg-yellow-100 hover:bg-yellow-200",
      slate: "text-slate-600 bg-slate-100 hover:bg-slate-200",
    },

    text: {
      emerald: "text-emerald-500 hover:underline",
      blue: "text-blue-500 hover:underline",
      black: "text-black hover:underline",
      red: "text-red-500 hover:underline",
      orange: "text-orange-500 hover:underline",
      yellow: "text-yellow-600 hover:underline",
      slate: "text-slate-600 hover:underline",
    },

    gradient: {
      emerald: "bg-gradient-to-br from-emerald-400 to-emerald-800 text-white hover:from-emerald-600 hover:to-emerald-800",
      blue: "bg-gradient-to-br from-blue-400 to-blue-800 text-white hover:from-blue-600 hover:to-blue-800",
      black: "bg-gradient-to-br from-zinc-600 to-black text-white hover:from-black hover:to-zinc-900",
      red: "bg-gradient-to-br from-red-400 to-red-800 text-white hover:from-red-600 hover:to-red-800",
      orange: "bg-gradient-to-br from-orange-400 to-orange-800 text-white hover:from-orange-600 hover:to-orange-800",
      yellow: "bg-gradient-to-br from-yellow-300 to-yellow-600 text-black hover:from-yellow-500 hover:to-yellow-700",
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
      {loading ? <CgSpinner className="animate-spin" /> : children}
    </button>
  );
}

export default IconButton;
