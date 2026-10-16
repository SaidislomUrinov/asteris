import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import uz from "../lang/uz.json";

const LANG_KEY = "lang";

// Faqat `uz` (asosiy til va fallback) bundle'ga kiradi. Qolgan tillar
// (har biri 100–150 KB) alohida chunk — tanlanganda yuklanadi.
const LOADERS = {
  uzc: () => import("../lang/uzc.json"),
  ru: () => import("../lang/ru.json"),
  en: () => import("../lang/en.json"),
};

const savedLang = localStorage.getItem(LANG_KEY) || "uz";

i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
  },
  // Saqlangan til `loadLanguage` orqali main.jsx'da render'dan oldin ulanadi.
  lng: "uz",
  fallbackLng: "uz",
  // Kalitlarda ":" bor (audit.actions.center:update) — namespace ishlatilmaydi,
  // aks holda i18next ":" dan oldingi qismni namespace deb o'qib, xom kalit qaytaradi.
  nsSeparator: false,
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(LANG_KEY, lng);
});

/**
 * Til faylini (kerak bo'lsa) yuklab, tilni almashtiradi. Til almashtirish
 * har doim shu orqali — `i18n.changeLanguage` to'g'ridan-to'g'ri chaqirilsa
 * tarjimalar hali yuklanmagan bo'lib, matnlar uz tilida qolardi.
 *
 * @param {string} lng
 */
export async function changeLanguage(lng) {
  try {
    if (LOADERS[lng] && !i18n.hasResourceBundle(lng, "translation")) {
      const mod = await LOADERS[lng]();
      i18n.addResourceBundle(lng, "translation", mod.default);
    }
    await i18n.changeLanguage(LOADERS[lng] || lng === "uz" ? lng : "uz");
  } catch {
    // Chunk yuklanmasa (tarmoq) — uz tilida qoladi.
    await i18n.changeLanguage("uz");
  }
}

/** Ilova ochilishida saqlangan tilni ulaydi (main.jsx, render'dan oldin). */
export const initSavedLanguage = () => (savedLang === "uz" ? Promise.resolve() : changeLanguage(savedLang));

export default i18n;
