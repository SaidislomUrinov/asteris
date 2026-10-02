const env = require("../configs/env.config");

const parseError = (err) => {
  const message = err?.message || "Internal server error";

  if (!err?.stack) {
    return { message, file: null, line: null };
  }

  const lines = err.stack.split("\n");

  const targetLine = lines[1] || "";

  const match =
    targetLine.match(/\((.*):(\d+):(\d+)\)/) ||
    targetLine.match(/at (.*):(\d+):(\d+)/);

  if (!match) {
    return { message, file: null, line: null };
  }

  return {
    message,
    file: match[1],
    line: Number(match[2]),
  };
};

// Biznes xatolari i18n kaliti ko'rinishida tashlanadi ("center.notFound",
// "auth.failed"). Shu naqshga TUSHMAYDIGAN xato — kutilmagan server xatosi
// (5xx), ya'ni Telegram'ga ogohlantirish yuborilishi kerak.
const I18N_KEY = /^[a-zA-Z][\w]*\.[\w]+$/;

// Noto'g'ri KIRISH ma'lumotidan kelib chiqqan xatolar — server xatosi emas:
// Mongoose CastError/ValidationError ("Cast to ObjectId failed", "Cast to
// Number failed") va buzilgan JSON body. Avval xom matn foydalanuvchiga
// ko'rinardi va har biri Telegram'ga 5xx alert yuborardi (QA 2026-10-02).
// Satr kutilgan joyga obyekt/son/massiv kelganda servislardagi `.trim()`
// kabi chaqiruvlar shu TypeError'ni beradi ("name.trim is not a function").
const STRING_METHOD_ON_WRONG_TYPE =
  /\.(trim|toLowerCase|toUpperCase|split|replace|startsWith|endsWith|padStart|localeCompare) is not a function$/;

const isInputError = (err) =>
  (err?.name === "TypeError" && STRING_METHOD_ON_WRONG_TYPE.test(err?.message || "")) ||
  err?.name === "CastError" ||
  err?.name === "ValidationError" ||
  err?.name === "BSONError" ||
  err?.type === "entity.parse.failed";

const isServerError = (err) => {
  if (isInputError(err)) return false;
  const status = err?.status || err?.statusCode;
  if (status) return status >= 500;
  return !I18N_KEY.test(err?.message || "");
};

// Foydalanuvchiga boradigan matn: biznes xatosi — o'z i18n kaliti; kirish
// xatosi — `common.invalidInput`; qolgan kutilmagan xato (TypeError va h.k.)
// — umumiy `common.error` (ichki matn/stack tashqariga chiqmaydi, u Telegram
// alerti va server logida qoladi).
const publicMessage = (err, parsed) => {
  if (isInputError(err)) return "common.invalidInput";
  if (I18N_KEY.test(parsed.message)) return parsed.message;
  return "common.error";
};

// Fire-and-forget: alert yuborilmasa ham javob allaqachon ketgan.
// Throttle (daqiqasiga 1 xabar) `bot/alert.js` ichida.
const notifyServerError = (err, req, parsed) => {
  try {
    require("../bot/alert")
      .sendAlert("serverError", {
        title: "Server xatosi (5xx)",
        body: parsed.message,
        meta: {
          "Yo'l": `${req?.method || ""} ${req?.originalUrl || ""}`.trim(),
          Fayl: parsed.file ? `${parsed.file}:${parsed.line}` : "",
          IP: req?.ip || "",
          PID: process.pid,
        },
      })
      .catch(() => {});
  } catch {
    // bot moduli yuklanmasa ham server ishlayveradi
  }
};

module.exports = (err, req, res, _next) => {
  env.NODE_ENV !== "production" && console.log(err);

  const parsed = parseError(err);

  if (isServerError(err)) notifyServerError(err, req, parsed);

  return res.send({
    ok: false,
    msg: publicMessage(err, parsed),
    ...(err?.lockedBy ? { lockedBy: err.lockedBy } : {}),
    ...(err?.conflict ? { conflict: err.conflict } : {}),
    // Import bekor qilishda "nechta yozuv to'sqinlik qilyapti" (`blockedCount`)
    // — `conflict`/`lockedBy` bilan bir xil naqsh, umumiy passthrough.
    ...(err?.data ? { data: err.data } : {}),
    // Mashina o'qiydigan biznes kodi (masalan INVALID_TELEGRAM_PHONE) — faqat
    // string; Mongo'ning raqamli `code`i (11000) chiqmaydi.
    ...(typeof err?.code === "string" && /^[A-Z][A-Z0-9_]+$/.test(err.code) ? { code: err.code } : {}),
  });
};
