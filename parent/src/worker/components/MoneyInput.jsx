import { useTranslation } from "react-i18next";
import { maskMoney } from "../utils";

// Summa maydoni: raqamli klaviatura, "1 250 000" maskasi, UZS.
export const MoneyInput = ({ label, value, onChange, autoFocus }) => {
  const { t } = useTranslation();
  return (
    <label className="block rounded-2xl border border-line px-3.5 py-2.5 focus-within:border-accent transition-colors">
      <span className="block text-[11px] font-bold text-hint">{label}</span>
      <span className="flex items-baseline gap-2">
        <input
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          value={maskMoney(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder="0"
          className="tabular font-bold text-[22px] bg-transparent outline-none w-full min-w-0 text-ink placeholder:text-hint/50"
        />
        <span className="text-sm font-bold text-hint shrink-0">{t("common.sum")}</span>
      </span>
    </label>
  );
};
