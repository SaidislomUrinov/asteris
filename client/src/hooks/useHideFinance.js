import { useCallback, useSyncExternalStore } from "react";

const KEY = "asteris:hideFinance";
const listeners = new Set();

const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

let hidden = read();

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const setHidden = (next) => {
  hidden = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // Saqlab bo'lmasa ham joriy sessiyada ishlayveradi.
  }
  listeners.forEach((fn) => fn());
};

/**
 * Moliyaviy raqamlarni yashirish — Owner Dashboard, Reception va Teacher
 * bosh sahifalarining BARCHASI shu BITTA tanlovdan foydalanadi (bitta
 * `localStorage` kaliti), chunki xodim panellar orasida o'tganda ham
 * xohlagan holat (yashirilgan/ko'rinadigan) saqlanib qolishi kerak —
 * resepshin oldida odam o'tirgan yoki noutbuk HDMI orqali proyektorga
 * ulangan holatlar uchun.
 *
 * Holat modul darajasida (useTheme naqshi): tugma Top panelda, raqamlar
 * sahifada — ikkalasi bir xil qiymatni darhol ko'radi.
 *
 * @returns {[boolean, () => void]} [hidden, toggle]
 */
export default function useHideFinance() {
  const value = useSyncExternalStore(subscribe, () => hidden, () => false);
  const toggle = useCallback(() => setHidden(!hidden), []);
  return [value, toggle];
}
