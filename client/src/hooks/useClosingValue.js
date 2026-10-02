import { useEffect, useRef, useState } from "react";

// Dialog chiqish animatsiyasi 200ms (index.css `--animate-dialog-out`).
// Biroz zaxira bilan ushlab turamiz, aks holda oxirgi kadr kesilib qoladi.
const EXIT_MS = 260;

/**
 * Modal yopilayotganda uning ma'lumotini animatsiya tugaguncha ushlab turadi.
 *
 * Muammo: `{payTarget && <PaymentDialog open={!!payTarget} ... />}` naqshida
 * `setPayTarget(null)` butun modalni SHU ZAHOTI unmount qiladi — `Dialog`
 * ichidagi "closing" fazasi umuman render bo'lmaydi va modal sakrab yo'qoladi.
 *
 * Yechim: guard uchun shu hook qaytargan "ko'rinish" qiymatidan foydalanamiz,
 * `open` esa asl qiymatga bog'liq qoladi:
 *
 *   const payView = useClosingValue(payTarget);
 *   {payView && <PaymentDialog open={!!payTarget} data={payView} />}
 *
 * Natijada `payTarget` null bo'lganda `open` false bo'ladi (chiqish
 * animatsiyasi boshlanadi), lekin komponent yana ~260ms mount holatida
 * turadi va animatsiya oxirigacha ko'rinadi.
 */
function useClosingValue(value) {
  const [held, setHeld] = useState(value);
  const timerRef = useRef(null);

  // setState effekt tanasida emas, taymer ichida chaqiriladi — loyihada
  // `react-hooks/set-state-in-effect` uchun qabul qilingan naqsh.
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHeld(value || null), value ? 0 : EXIT_MS);
    return () => clearTimeout(timerRef.current);
  }, [value]);

  // Ochilishda kechikish bo'lmasligi uchun yangi qiymat darhol qaytariladi
  // (`setHeld` keyingi renderda yetib keladi).
  return value || held;
}

export default useClosingValue;
