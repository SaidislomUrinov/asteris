import { useCallback, useState } from "react";

const KEY = "asteris:hideFinance";

/**
 * Moliyaviy raqamlarni yashirish — Owner Dashboard, Reception va Teacher
 * bosh sahifalarining BARCHASI shu BITTA tanlovdan foydalanadi (bitta
 * `localStorage` kaliti), chunki xodim panellar orasida o'tganda ham
 * xohlagan holat (yashirilgan/ko'rinadigan) saqlanib qolishi kerak —
 * resepshin oldida odam o'tirgan yoki noutbuk HDMI orqali proyektorga
 * ulangan holatlar uchun.
 *
 * @returns {[boolean, () => void]} [hidden, toggle]
 */
export default function useHideFinance() {
  const [hidden, setHidden] = useState(() => localStorage.getItem(KEY) === "1");

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return [hidden, toggle];
}
