// Telefon raqamini yagona formatga keltiradi: `+998901234567`.
//
// Qabul qiladi: "998901234567", "90 123 45 67", "+998 (90) 123-45-67",
// "8 90 123 45 67" va h.k. Ota-ona raqami (`Student.parentPhone`) Telegram
// `request_contact` dan kelgan raqam bilan AYNAN taqqoslanadi — shuning
// uchun yozishda ham, qidirishda ham shu funksiya ishlatilishi shart.
// Tanib bo'lmaydigan qiymat (harflar, juda qisqa) o'zgarmagan holda,
// faqat trim qilib qaytariladi — hech narsa jimgina yo'qolmaydi.
const normalizePhone = (raw) => {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith("8")) return `+998${digits.slice(1)}`;
  return s;
};

// Telegram raqami — ISTALGAN davlat (API_CONTRACT_telegram_phone.md §2).
// Avval O'zbekiston qoidalari (`normalizePhone` bilan bir xil), aks holda
// 7–15 raqamli E.164 → `"+" + digits`. Telegram `contact.phone_number` ham
// shu funksiyadan o'tadi (xorijiy raqam `+` bilan yoki `+`siz kelishi mumkin).
// Qaytaradi: bo'sh → `""`, tanib bo'lmasa → `null` (validatsiya uchun).
const normalizeTelegramPhone = (raw) => {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith("8")) return `+998${digits.slice(1)}`;
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  return null;
};

// Mongoose setter uchun: tanib bo'lmasa — trim qilingan qiymat (hech narsa
// jimgina yo'qolmaydi).
const setTelegramPhone = (raw) => {
  const n = normalizeTelegramPhone(raw);
  return n === null ? String(raw).trim() : n;
};

module.exports = { normalizePhone, normalizeTelegramPhone, setTelegramPhone };
