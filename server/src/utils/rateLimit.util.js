// express-rate-limit o'rami — chegaradan oshganda oddiy matn ("Too many
// requests") emas, API konvensiyasidagi JSON qaytaradi (`{ ok:false, msg }`),
// frontend uni i18n kaliti sifatida tarjima qiladi. Imzo asl `rateLimit`
// bilan bir xil — route fayllarida faqat `require` yo'li almashtirilgan.
const rateLimit = require("express-rate-limit");

module.exports = (options = {}) =>
  rateLimit({
    ...options,
    // Status 200 — loyiha konvensiyasi (frontend `ok:false`ni o'qiydi; 429 da
    // axios xatoni "aloqa yo'q" deb ko'rsatardi).
    handler: (req, res) => res.send({ ok: false, msg: "common.tooManyRequests" }),
  });
