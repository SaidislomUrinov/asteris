const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const parentController = require("../controllers/parent.controller");

const router = Router();

// initData bilan token olish — WebApp har ochilganda chaqiradi (refresh yo'q),
// lekin brute-force/dev chatId sanab chiqishdan himoya uchun limit.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/telegram", authLimiter, parentController.authTelegram);

module.exports = router;
