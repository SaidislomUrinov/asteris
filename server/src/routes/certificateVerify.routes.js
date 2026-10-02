const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const certificateVerifyController = require("../controllers/certificateVerify.controller");

const router = Router();

// PUBLIC — QR skanerlangach hech qanday login talab qilinmaydi. Faqat
// ko'rsatish uchun matn qaytariladi (certificate.service.js#verify),
// suiiste'moldan himoya uchun rate limit qo'yiladi (inpayWebhook.routes.js
// bilan bir xil naqsh).
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/:code", verifyLimiter, certificateVerifyController.verify);

module.exports = router;
