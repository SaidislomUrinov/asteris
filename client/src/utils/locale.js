import i18n from "./i18n";

// Ilova tili → sana/vaqt formatlash uchun Intl locale. Brauzer tiliga emas,
// foydalanuvchi ilovada TANLAGAN tilga bog'lanadi ("uzc" — kirill yozuvi).
// Pul summalari bundan mustasno: ular butun loyihada bir xil ko'rinishi
// uchun doim `uz-UZ` (utils/moneyFormat.js).
const LOCALES = { uz: "uz-UZ", uzc: "uz-Cyrl-UZ", ru: "ru-RU", en: "en-GB" };

export const dateLocale = () => LOCALES[i18n.language] || LOCALES.uz;
