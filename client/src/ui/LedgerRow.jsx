import NumberText from "./NumberText";

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;

/**
 * Moliyaviy "ledger" qatori — alohida to'rtburchak karta o'rniga bitta
 * ro'yxat ichida, rang semantikasi bilan (yashil = ijobiy, qizil = chegirma).
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {number} props.value
 * @param {"positive"|"negative"|"neutral"} [props.tone="neutral"]
 */
function LedgerRow({ label, value, tone = "neutral" }) {
  const toneClass =
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-slate-800";
  const sign = tone === "positive" ? "+" : tone === "negative" ? "−" : "";
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <NumberText className={`${toneClass} text-[15px]`}>
        {sign}
        {money(value)}
      </NumberText>
    </div>
  );
}

export default LedgerRow;
