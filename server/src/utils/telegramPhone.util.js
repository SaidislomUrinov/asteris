const { normalizeTelegramPhone } = require("./phone.util");

// Alohida Telegram raqami (API_CONTRACT_telegram_phone.md §1).
//
// INVARIANT: `*TelegramPhone` doim SAMARALI qiymatni saqlaydi —
//   `*Same === true`  → telefondan hisoblangan (`normalizeTelegramPhone(phone)`)
//   `*Same === false` → foydalanuvchi kiritgan (normalizatsiya qilingan) yoki "".
// Shu sabab bot/bildirishnoma/badge qidiruvlari bitta maydon bo'yicha ishlaydi
// ($or va fallback yo'q). Student VA StudentLead uchun bir xil — faqat shu
// helper orqali yoziladi (create/update/import/lead-enroll).

// [sameKey, phoneKey, manba telefon maydoni]
const PAIRS = [
  ["telegramSame", "telegramPhone", "phone"],
  ["parentTelegramSame", "parentTelegramPhone", "parentPhone"],
];

const FIELDS = PAIRS.flatMap(([same, phone]) => [same, phone]);

// Loyiha konvensiyasi: biznes xatosi i18n kaliti bilan, HTTP 200 + `{ ok:false,
// msg }` (client fetching.js shunga tayanadi). `code` error.util orqali javobga
// qo'shiladi.
const invalidTelegramPhone = (errorKey) => {
  const err = new Error(errorKey);
  err.code = "INVALID_TELEGRAM_PHONE";
  return err;
};

// Body'dagi `*Same` qiymati: boolean yoki "true"/"false" (multipart/Excel).
// Yuborilmagan → `undefined`.
const parseSame = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  if (v === false || v === "false" || v === 0 || v === "0") return false;
  return true;
};

// `doc` — Mongoose hujjati yoki oddiy obyekt. `phone`/`parentPhone` ALLAQACHON
// yangi qiymatga o'rnatilgan bo'lishi kerak (setter normalizatsiyasidan keyin)
// — shunda `*Same === true` bo'lganda Telegram raqami avtomatik qayta sinxronlanadi.
//
// - Maydon yuborilmasa: create'da `true`, update'da mavjud qiymat saqlanadi.
// - `*Same === true` bo'lsa `*TelegramPhone` body'dan e'tiborsiz qoldiriladi.
// - `*Same === false` + noto'g'ri raqam → `errorKey` (code INVALID_TELEGRAM_PHONE).
const applyTelegramFields = (doc, body = {}, { isNew = false, errorKey = "student.invalidTelegramPhone" } = {}) => {
  const src = body || {};
  for (const [sameKey, phoneKey, sourceKey] of PAIRS) {
    const sent = parseSame(src[sameKey]);
    const same = sent !== undefined ? sent : isNew ? true : doc[sameKey] !== false;

    if (same) {
      doc[phoneKey] = normalizeTelegramPhone(doc[sourceKey]) || "";
    } else if (src[phoneKey] !== undefined) {
      const raw = String(src[phoneKey] ?? "").trim();
      if (!raw) {
        doc[phoneKey] = "";
      } else {
        const n = normalizeTelegramPhone(raw);
        if (n === null) throw invalidTelegramPhone(errorKey);
        doc[phoneKey] = n;
      }
    } else if (isNew) {
      doc[phoneKey] = "";
    }
    // update + `false` + raqam yuborilmagan → mavjud qiymat saqlanadi.
    doc[sameKey] = same;
  }
  return doc;
};

// DTO uchun 4 maydon. Migratsiya skripti hali ishlamagan eski hujjatda
// (maydon yo'q / lean) → `*Same: true` va telefondan hisoblangan samarali qiymat.
const telegramFieldsOf = (s) => {
  const out = {};
  for (const [sameKey, phoneKey, sourceKey] of PAIRS) {
    const same = s?.[sameKey] !== false;
    out[sameKey] = same;
    out[phoneKey] = same ? normalizeTelegramPhone(s?.[sourceKey]) || "" : s?.[phoneKey] || "";
  }
  return out;
};

// Body'da Telegram maydonlaridan birortasi bormi (update'da "hech narsa
// yuborilmadi" tekshiruvi uchun).
const hasTelegramFields = (body = {}) => FIELDS.some((k) => body?.[k] !== undefined);

// Body'dan faqat Telegram maydonlarini ajratib oladi (whitelist'lar uchun).
const pickTelegramFields = (body = {}) => {
  const out = {};
  for (const k of FIELDS) if (body?.[k] !== undefined) out[k] = body[k];
  return out;
};

// Excel import qatori (API_CONTRACT_telegram_phone.md §4 "Excel import"):
// `row.telegramPhone` ("O'quvchi Telegram" ustuni) va `row.parentTelegramPhone`
// ("Ota-ona Telegram" ustuni) — xom qiymatlar.
//   bo'sh                → `*Same: true` (faqat yangi hujjatda yuboriladi —
//                          mavjud o'quvchining sozlamasi o'zgarmasin)
//   telefonga teng       → `*Same: true`
//   farqli               → `*Same: false`, `*TelegramPhone` = shu qiymat
//                          (noto'g'ri raqam → applyTelegramFields qator xatosi)
// Frontend `*Same`ni aniq yuborgan bo'lsa — o'sha ishlatiladi.
const telegramFieldsFromImportRow = (row = {}, { isNew = true } = {}) => {
  const out = {};
  for (const [sameKey, phoneKey, sourceKey] of PAIRS) {
    const explicit = parseSame(row[sameKey]);
    const raw = String(row[phoneKey] ?? "").trim();
    if (explicit !== undefined) {
      out[sameKey] = explicit;
      if (!explicit) out[phoneKey] = raw;
      continue;
    }
    if (!raw) {
      if (isNew) out[sameKey] = true;
      continue;
    }
    const n = normalizeTelegramPhone(raw);
    const base = normalizeTelegramPhone(row[sourceKey]);
    if (n && base && n === base) {
      out[sameKey] = true;
    } else {
      out[sameKey] = false;
      out[phoneKey] = raw;
    }
  }
  return out;
};

module.exports = {
  telegramFieldsFromImportRow,
  TELEGRAM_FIELDS: FIELDS,
  applyTelegramFields,
  telegramFieldsOf,
  hasTelegramFields,
  pickTelegramFields,
};
