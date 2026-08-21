import { useCallback, useSyncExternalStore } from "react";

/**
 * CSS media query'ni JS tomonda kuzatadi.
 *
 * Ba'zi joylarda faqat `hidden lg:flex` bilan kifoyalanib bo'lmaydi — masalan
 * filtrlarni mobil ekranda Modal ichiga, katta ekranda esa sahifaga joylash
 * kerak. Ikkala joyda ham render qilish bir xil input'ning DUBLIKATIga olib
 * keladi (bir xil `id`, ikki marta focus/scroll), shuning uchun qaysi biri
 * render bo'lishini shu hook hal qiladi.
 *
 * `useSyncExternalStore` ishlatilgan — brauzer (tashqi manba) holatiga
 * obuna bo'lish uchun aynan shu API mo'ljallangan va u `useEffect` ichida
 * setState chaqirishni (lint qoidasi taqiqlaydi) talab qilmaydi.
 *
 * @param {string} query — masalan "(min-width: 640px)"
 * @returns {boolean}
 */
function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export default useMediaQuery;
