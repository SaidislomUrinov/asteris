import { useTranslation } from "react-i18next";
import CoinIcon from "../../ui/CoinIcon";
import Switch from "../../ui/Switch";

/**
 * Individual o'quvchiga WECOIN berish switchi
 * (docs/API_CONTRACT_individual_coins.md). Faqat filialda WECOIN
 * ishlayotganda chiziladi — shartni chaqiruvchi tekshiradi.
 *
 * @param {Object} props
 * @param {boolean} props.checked
 * @param {(v: boolean) => void} props.onChange
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.compact] - guruh detali kartasidagi ixcham qator
 */
function CoinsSwitchRow({ checked, onChange, disabled = false, compact = false }) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex items-center gap-2.5 min-w-0 ${
        compact
          ? ""
          : "h-11 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-800/60 px-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      }`}
    >
      <CoinIcon size={compact ? 20 : 24} muted={!checked} />
      <p className="min-w-0 flex-1 text-sm font-semibold whitespace-nowrap text-slate-800 dark:text-slate-100 truncate">
        {compact ? "WECOIN" : t("individual.coins")}
      </p>
      <div className="shrink-0">
        <Switch checked={checked} onChange={onChange} disabled={disabled} color="yellow" />
      </div>
    </div>
  );
}

export default CoinsSwitchRow;
