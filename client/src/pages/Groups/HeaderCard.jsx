import { accentOf } from "../../utils/accent";

/**
 * Guruh detali (`/groups/:id`) va Dars (`/lesson`) sahifalari tepasidagi
 * IXCHAM karta — umumiy `ui/InfoCard`/`ui/MetricCard` bilan bir xil vizual
 * til (oq karta + chap chekkada rangli chiziq), lekin kichikroq: tepadagi
 * kartalar sahifaning asosiy qismi (o'quvchilar ro'yxati) ni pastga
 * surmasligi kerak. Umumiy komponentlar 7 ta sahifada ishlatilgani uchun
 * ularga tegilmaydi — bu variant faqat shu ikki sahifaga.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.icon
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.subtitle]
 * @param {React.ReactNode} [props.badge] - o'ng yuqoridagi element
 * @param {React.ReactNode} [props.value] - asosiy raqam
 * @param {React.ReactNode} [props.suffix]
 * @param {keyof import("../../utils/accent").ACCENT} [props.accent="blue"]
 * @param {boolean} [props.strong] - sarlavha katta (guruh nomi kartasi)
 */
function HeaderCard({
  icon,
  title,
  subtitle,
  badge,
  value,
  suffix,
  accent = "blue",
  strong = false,
  children,
  className = "",
}) {
  const a = accentOf(accent);

  return (
    <div
      className={`relative overflow-hidden flex flex-col gap-2 p-3 pl-4 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none min-w-0 ${className}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${a.edge}`} />

      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-base ${a.icon}`}
        >
          {icon}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <p
            className={
              strong
                ? "font-space font-bold text-base leading-snug text-slate-900 dark:text-slate-100 truncate"
                : "text-sm font-semibold text-slate-800 dark:text-slate-100 truncate"
            }
          >
            {title}
          </p>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{subtitle}</p>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {value != null && (
        <p className="text-xl font-space font-bold text-slate-900 dark:text-slate-100 leading-none tabular-nums truncate">
          {value}
          {suffix ? <span className="text-sm font-normal text-slate-400 dark:text-slate-500"> {suffix}</span> : null}
        </p>
      )}

      {children}
    </div>
  );
}

export default HeaderCard;
