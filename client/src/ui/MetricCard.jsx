import { accentOf } from "../utils/accent";

/**
 * Detail sahifalari tepasidagi ko'rsatkich kartasi (o'quvchilar soni, oylik
 * to'lov, guruhlar soni...). Oq karta + chap chekkada rangli chiziq.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.icon
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.subtitle] - kichik izoh
 * @param {React.ReactNode} [props.value] - asosiy raqam
 * @param {React.ReactNode} [props.suffix] - raqam yonidagi birlik ("so'm", "/ 20"...)
 * @param {keyof import("../utils/accent").ACCENT} [props.accent="blue"]
 * @param {React.ReactNode} [props.children] - qo'shimcha blok (ProgressBar...)
 */
function MetricCard({
  icon,
  title,
  subtitle,
  value,
  suffix,
  accent = "blue",
  children,
  className = "",
}) {
  const a = accentOf(accent);

  return (
    <div
      className={`relative overflow-hidden flex flex-col gap-3 p-5 pl-6 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${a.edge}`} />

      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-lg ${a.icon}`}
        >
          {icon}
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="font-semibold text-slate-800 truncate">{title}</p>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>
      </div>

      {value != null && (
        <p className="text-2xl font-space font-bold text-slate-900 leading-none">
          {value}
          {suffix ? <span className="text-base font-normal text-slate-400"> {suffix}</span> : null}
        </p>
      )}

      {children}
    </div>
  );
}

export default MetricCard;
