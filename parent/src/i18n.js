import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import uz from "./lang/uz.json";
import ru from "./lang/ru.json";
import en from "./lang/en.json";

i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: "uz",
  fallbackLng: "uz",
  // Kalitlarda ":" bor (audit.actions.center:update) — namespace ishlatilmaydi,
  // aks holda i18next ":" dan oldingi qismni namespace deb o'qib, xom kalit qaytaradi.
  nsSeparator: false,
  interpolation: { escapeValue: false },
});

export default i18n;
