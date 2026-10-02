import { useState } from "react";

const readValue = (key, initialValue) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return typeof initialValue === "function" ? initialValue() : initialValue;
    return JSON.parse(raw);
  } catch {
    return typeof initialValue === "function" ? initialValue() : initialValue;
  }
};

/**
 * `useState` bilan bir xil, lekin qiymat `sessionStorage`da ham saqlanadi.
 *
 * Nega kerak: ro'yxat sahifasida (Students, Groups, Staff, Centers, Rooms...)
 * filtr/qidiruv/sahifa — oddiy `useState`. Elementga bosib Detail sahifasiga
 * o'tilganda list komponenti UNMOUNT bo'ladi, "Orqaga" tugmasi (`navigate(-1)`)
 * bilan qaytilganda esa QAYTA MOUNT bo'ladi — shu sabab barcha `useState`lar
 * boshlang'ich qiymatga tushib, filtr "yangilanib" ketardi. Bu hook holatni
 * sessionStorage'da saqlab, qayta mount bo'lganda tiklaydi.
 *
 * `sessionStorage` (localStorage emas) ataylab tanlangan — filtr faqat shu
 * sessiya/tab doirasida "yopishib qoladi", boshqa tab yoki keyingi safar
 * ochilganda toza holatdan boshlanadi.
 *
 * `key` shu sahifaga xos NOYOB satr bo'lishi kerak (masalan "students.search"),
 * aks holda turli sahifalar bir-birining qiymatini bosib yuboradi.
 */
export default function usePersistedState(key, initialValue) {
  const [state, setState] = useState(() => readValue(key, initialValue));

  const setPersisted = (value) => {
    setState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        // sessionStorage yo'q/bloklangan (private mode va h.k.) — jim,
        // faqat runtime state ishlashda davom etadi
      }
      return next;
    });
  };

  return [state, setPersisted];
}
