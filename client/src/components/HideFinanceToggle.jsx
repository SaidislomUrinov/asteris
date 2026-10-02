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
 */
function HideFinanceToggle({ hidden, onToggle, className = "" }) {
  const { t } = useTranslation();
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
