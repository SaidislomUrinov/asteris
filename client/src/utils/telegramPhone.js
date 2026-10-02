// Alohida Telegram raqami (o'quvchi va ota-ona) — docs/API_CONTRACT_telegram_phone.md.
// Telegram raqami istalgan davlatniki bo'lishi mumkin: faqat boshidagi "+"
// va raqamlar, E.164 bo'yicha 7–15 raqam.

export const TELEGRAM_DEFAULT_PREFIX = "+998";
const MIN_DIGITS = 7;
const MAX_DIGITS = 15;

// Kiritishni tozalaydi: "+" faqat boshida, qolgani raqamlar, max 15 raqam.
export const sanitizeTelegramInput = (raw) => {
  const str = String(raw ?? "");
  const plus = str.trimStart().startsWith("+") ? "+" : "";
  const digits = str.replace(/\D/g, "").slice(0, MAX_DIGITS);
  return plus + digits;
};

const digitsOf = (raw) => String(raw ?? "").replace(/\D/g, "");

// Foydalanuvchi faqat default prefiksni qoldirgan bo'lsa ("+998" yoki "+")
// — bu "bo'sh" hisoblanadi (ixtiyoriy maydon, botga ulanmaydi).
export const cleanTelegramValue = (raw) => {
  const value = sanitizeTelegramInput(raw);
  const digits = digitsOf(value);
  if (!digits || value === TELEGRAM_DEFAULT_PREFIX) return "";
  return value;
};

// Bo'sh qiymat ham to'g'ri (ixtiyoriy).
export const isValidTelegramPhone = (raw) => {
  const value = cleanTelegramValue(raw);
  if (!value) return true;
  const len = digitsOf(value).length;
  return len >= MIN_DIGITS && len <= MAX_DIGITS;
};

// DTO'dan forma holati. `*Same` yo'q bo'lsa (eski hujjat) — `true`.
export const telegramFormFromDto = (dto) => {
  const telegramSame = dto?.telegramSame !== false;
  const parentTelegramSame = dto?.parentTelegramSame !== false;
  return {
    telegramSame,
    telegramPhone: telegramSame ? "" : dto?.telegramPhone || "",
    parentTelegramSame,
    parentTelegramPhone: parentTelegramSame ? "" : dto?.parentTelegramPhone || "",
  };
};

export const EMPTY_TELEGRAM_FORM = {
  telegramSame: true,
  telegramPhone: "",
  parentTelegramSame: true,
  parentTelegramPhone: "",
};

// Formadagi Telegram maydonlari to'g'riligini tekshiradi — xato bo'lsa
// i18n kalitini tashlaydi (dialoglardagi `throw new Error(key)` naqshi).
export const assertTelegramForm = (form) => {
  if (!form.telegramSame && !isValidTelegramPhone(form.telegramPhone))
    throw new Error("telegramPhone.invalidStudent");
  if (!form.parentTelegramSame && !isValidTelegramPhone(form.parentTelegramPhone))
    throw new Error("telegramPhone.invalidParent");
};

// So'rov tanasi uchun 4 maydon: `*TelegramPhone` faqat `*Same === false`
// bo'lganda yuboriladi (bo'sh satr ham ruxsat — "botga ulanmasin").
//
// `dto` (tahrirlashda) berilsa va unda `*Same` maydoni umuman yo'q bo'lsa
// (masalan qisqartirilgan DTO), foydalanuvchi belgiga tegmagan juftlik
// yuborilmaydi — serverdagi mavjud qiymat tasodifan "bir xil"ga qaytmasin.
export const buildTelegramPayload = (form, dto) => {
  const pair = (sameKey, phoneKey) => {
    if (dto && dto[sameKey] === undefined && form[sameKey]) return {};
    return form[sameKey]
      ? { [sameKey]: true }
      : { [sameKey]: false, [phoneKey]: cleanTelegramValue(form[phoneKey]) };
  };
  return {
    ...pair("telegramSame", "telegramPhone"),
    ...pair("parentTelegramSame", "parentTelegramPhone"),
  };
};
