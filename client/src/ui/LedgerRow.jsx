import NumberText from "./NumberText";
import { maskMoney } from "../utils/moneyFormat";

/**
 * Moliyaviy "ledger" qatori — alohida to'rtburchak karta o'rniga bitta
 * ro'yxat ichida, rang semantikasi bilan (yashil = ijobiy, qizil = chegirma).
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {number} props.value
 * @param {"positive"|"negative"|"neutral"} [props.tone="neutral"]
 * @param {boolean} [props.hidden=false] — `useHideFinance` — ko'z belgisi
 *   yopiq bo'lsa qiymat "****" bilan almashtiriladi.
 */
function LedgerRow({ label, value, tone = "neutral", hidden = false }) {
  const toneClass =
    tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : tone === "negative" ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-100";
  const sign = tone === "positive" ? "+" : tone === "negative" ? "−" : "";
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <NumberText className={`${toneClass} text-[15px]`}>
        {!hidden && sign}
        {maskMoney(value, hidden)}
      </NumberText>
    </div>
  );
}

export default LedgerRow;
