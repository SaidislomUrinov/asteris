import { useCallback, useEffect, useRef } from "react";

/**
 * Funksiyani debounce qiladi (trailing edge) — ketma-ket chaqiriqlar to'planib,
 * oxirgisidan `delay` ms o'tgach BITTA marta bajariladi.
 *
 * Nima uchun kerak: Dashboard `attendance:marked` hodisasiga obuna, va u har
 * QR skanida keladi. Ertalabki oqimda (200 o'quvchi kirayotganda) har skan
 * og'ir `/dashboard` so'rovini qayta yuborardi — daqiqada yuzlab so'rov.
 * Debounce bilan hodisalar to'planadi, so'rov bitta ketadi.
 * API_CONTRACT_performance.md §4.
 *
 * `fn` har renderda yangi funksiya bo'lsa ham taymer qayta ishga tushmaydi —
 * eng so'nggi versiyasi ref'da saqlanadi.
 *
 * @param {Function} fn
 * @param {number} delay - ms
 */
export function useDebouncedCallback(fn, delay = 3000) {
  const fnRef = useRef(fn);
  const timerRef = useRef(null);

  useEffect(() => {
    fnRef.current = fn;
  });

  // Komponent yo'q bo'lganda kutayotgan chaqiruv bekor qilinadi, aks holda
  // unmount'dan keyin setState chaqirilib ketardi.
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return useCallback(
    (...args) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current?.(...args), delay);
    },
    [delay],
  );
}

export default useDebouncedCallback;
