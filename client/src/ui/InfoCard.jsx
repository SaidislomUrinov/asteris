import { accentOf } from "../utils/accent";

/**
 * Detail sahifalari tepasidagi "kim/nima" kartasi — nom, izoh, holat badge'i
 * va ostida erkin kontent (chiplar qatori, meta qatori...).
 *
 * @param {Object} props
 * @param {React.ReactNode} props.icon
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.subtitle]
 * @param {React.ReactNode} [props.badge] - o'ng yuqoridagi holat belgisi
 * @param {keyof import("../utils/accent").ACCENT} [props.accent="blue"]
 * @param {React.ReactNode} [props.media] - ikonka qutisi o'rniga (masalan tahrirlanadigan
 *   avatar, 44px) — berilsa `icon` e'tiborsiz qoldiriladi
 * @param {React.ReactNode} [props.children]
 */
function InfoCard({ icon, media, title, subtitle, badge, accent = "blue", children, className = "" }) {
  const a = accentOf(accent);

  return (
    <div
      className={`relative overflow-hidden flex flex-col gap-3 p-5 pl-6 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none ${className}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${a.edge}`} />

      <div className="flex items-start gap-3">
        {media || (
          <div
            className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-xl ${a.icon}`}
          >
            {icon}
          </div>
        )}
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <p className="font-space font-bold text-lg leading-snug text-slate-900 dark:text-slate-100 line-clamp-2 break-words">{title}</p>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{subtitle}</p>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {children}
    </div>
  );
}

export default InfoCard;

/**
 * InfoCard ichidagi meta qatori uchun kichik yordamchi (ikonka + matn).
 * Alohida fayl ochishga arzimaydigan darajada kichik va faqat shu yerda
 * ishlatiladi, lekin 7 ta sahifada takrorlanadi.
 */
export function InfoMeta({ icon, children }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0 text-sm text-slate-600 dark:text-slate-300">
      <span className="text-slate-300 dark:text-slate-600 shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}
