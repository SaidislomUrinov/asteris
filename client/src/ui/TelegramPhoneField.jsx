import { useTranslation } from "react-i18next";
import { HiPaperAirplane } from "react-icons/hi2";
import Checkbox from "./Checkbox";
import Input from "./Input";
import { TELEGRAM_DEFAULT_PREFIX, sanitizeTelegramInput } from "../utils/telegramPhone";

/**
 * Bitta shaxs (O'quvchi yoki Ota-ona) uchun ixcham "kontakt bloki": asosiy
 * telefon inputi (`children` orqali beriladi) va uning ostida "Telegram shu
 * raqamda" belgisi. Belgi o'chirilganda xuddi shu blok ichida alohida
 * Telegram raqami inputi ochiladi (istalgan davlat kodi, "+" bilan erkin)
 * (docs/API_CONTRACT_telegram_phone.md §7).
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Asosiy telefon inputi (masalan <Input .../>)
 * @param {boolean} [props.same=true] - Telefon = Telegram
 * @param {(same: boolean) => void} props.onSameChange
 * @param {string} [props.value] - Telegram raqami ("+..." ko'rinishida)
 * @param {(value: string) => void} props.onChange - Tozalangan qiymat bilan chaqiriladi
 * @param {string} [props.label] - Telegram inputi yorlig'i
 * @param {boolean} [props.disabled=false]
 */
function TelegramPhoneField({
  children,
  same = true,
  onSameChange = () => {},
  value = "",
  onChange = () => {},
  label = "",
  disabled = false,
}) {
  const { t } = useTranslation();

  const toggle = (checked) => {
    onSameChange(checked);
    // Birinchi ochilishda O'zbekiston kodi bilan boshlanadi — foydalanuvchi
    // uni o'chirib istalgan davlat kodini yoza oladi.
    if (!checked && !value) onChange(TELEGRAM_DEFAULT_PREFIX);
  };

  return (
    <div className="flex flex-col gap-2.5 w-full rounded-xl border border-slate-200 dark:border-night-700 bg-slate-50/60 dark:bg-night-800/60 p-2.5">
      {children}
      <Checkbox
        variant="square"
        checked={same}
        disabled={disabled}
        onChange={toggle}
        label={t("telegramPhone.sameLabel")}
        className="pl-0.5"
      />

      {!same && (
        <div className="pl-2 border-l-2 border-slate-200 dark:border-night-700">
          <div className="pl-2.5">
            <Input
              type="tel"
              inputMode="tel"
              label={label}
              placeholder="+998 90 123 45 67"
              hint={t("telegramPhone.hint")}
              icon={<HiPaperAirplane />}
              disabled={disabled}
              value={value}
              onChange={(e) => onChange(sanitizeTelegramInput(e.target.value))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default TelegramPhoneField;
