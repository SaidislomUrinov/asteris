const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const paymentVerifyController = require("../controllers/paymentVerify.controller");

const router = Router();

// PUBLIC — chekdagi QR skanerlangach hech qanday login talab qilinmaydi
// (certificateVerify.routes.js bilan bir xil naqsh).
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/:id", verifyLimiter, paymentVerifyController.verify);

module.exports = router;
