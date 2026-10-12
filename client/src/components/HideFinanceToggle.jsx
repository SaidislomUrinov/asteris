import { HiEye, HiEyeSlash } from "react-icons/hi2";
import { useTranslation } from "react-i18next";
import IconButton from "../ui/IconButton";

/**
 * Moliyaviy raqamlarni yashirish/ko'rsatish tugmasi — Owner Dashboard,
 * Reception va Teacher bosh sahifalarida BIR XIL ko'rinish va joyda
 * (sarlavha yonida, ko'z ikonkasi) — oson topiladigan, bashorat qilinadigan
 * joy. Holatni o'zi saqlamaydi: `hidden`/`onToggle` ota komponentdan keladi
 * (`useHideFinance` hook), shu sahifaning o'zi ham qiymatlarni niqoblash
 * uchun aynan shu holatdan foydalanadi.
 *
 * @param {Object} props
 * @param {boolean} props.hidden
 * @param {() => void} props.onToggle
 * @param {string} [props.className]
 * @param {boolean} [props.dark] - Top panelning to'q fonida
 */
function HideFinanceToggle({ hidden, onToggle, className = "", dark = false }) {
  const { t } = useTranslation();
  const label = t(hidden ? "common.showFinance" : "common.hideFinance");
  // Top panel (to'q fon) — yonidagi ThemeToggle/"?" bilan bir xil ko'rinish.
  if (dark) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={label}
        aria-label={label}
        className={`flex items-center justify-center w-7 sm:w-9 h-9 shrink-0 rounded-lg hover:bg-white/10 cursor-pointer transition-colors ${
          hidden ? "text-red-300 hover:text-red-200" : "text-white/70 hover:text-white"
        } ${className}`}
      >
        {hidden ? <HiEyeSlash size={20} /> : <HiEye size={20} />}
      </button>
    );
  }
  return (
    <IconButton
      variant={hidden ? "ghost" : "text"}
      color={hidden ? "red" : "slate"}
      className={`!min-w-9 !max-w-9 !min-h-9 !max-h-9 shrink-0 ${className}`}
      title={t(hidden ? "common.showFinance" : "common.hideFinance")}
      aria-label={t(hidden ? "common.showFinance" : "common.hideFinance")}
      onClick={onToggle}
    >
      {hidden ? <HiEyeSlash /> : <HiEye />}
    </IconButton>
  );
}

export default HideFinanceToggle;
