import { useEffect, useSyncExternalStore } from "react";

// MAJBURIY (yopilmaydigan) oynalar ro'yxati — obuna bloklangan modal,
// tarif pasayganda filial tanlash modali va intro tur. Yangiliklar popup'i
// (components/news/NewsPopup.jsx) shular ochiq turganda KUTADI
// (API_CONTRACT_news.md §5 "Popup" 2-band).
//
// Nega DOM/Redux emas: bu modallar holatini o'zlarining lokal state'ida
// yuritadi (masalan DowngradeModal `/centers/overflow` javobini) — DOM'dan
// qidirish mo'rt, Redux'ga ko'chirish esa ularni qayta yozishni talab
// qilardi. Har bir majburiy oyna mount bo'lganda `useBlockingModal(true)`
// orqali o'zini ro'yxatdan o'tkazadi, unmount'da o'chiradi.
let count = 0;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn());

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const getSnapshot = () => count > 0;

/** Majburiy oyna shu komponent mount bo'lib turganda "ochiq" hisoblanadi. */
export function useBlockingModal(active = true) {
  useEffect(() => {
    if (!active) return;
    count += 1;
    emit();
    return () => {
      count = Math.max(0, count - 1);
      emit();
    };
  }, [active]);
}

/** Hozir birorta majburiy oyna ochiqmi (reaktiv). */
export function useIsBlockingModalOpen() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
