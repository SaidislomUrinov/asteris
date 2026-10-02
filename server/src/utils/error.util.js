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

const isServerError = (err) => {
  const status = err?.status || err?.statusCode;
  if (status) return status >= 500;
  return !I18N_KEY.test(err?.message || "");
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
    msg: parsed.message,
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
