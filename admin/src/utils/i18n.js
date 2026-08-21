import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import uz from "../lang/uz.json";
import en from "../lang/en.json";

const LANG_KEY = "lang";

const savedLang = localStorage.getItem(LANG_KEY) || "uz";

i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: "uz",
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(LANG_KEY, lng);
});

export default i18n;
