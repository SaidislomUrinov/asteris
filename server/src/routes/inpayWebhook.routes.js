const { Router } = require("express");
const rateLimit = require("../utils/rateLimit.util");
const smsService = require("../services/sms.service");
const subscriptionPaymentService = require("../services/subscriptionPayment.service");

const router = Router();

// inPAY serverlari tomonidan chaqiriladi — auth yo'q, shuning uchun
// suiiste'mol/qalbakilashtirishdan himoya uchun rate limit qo'yiladi.
const callbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/callback", callbackLimiter, async (req, res, next) => {
  try {
    // Faqat satr — obyekt/massiv (`{"order_id":{...}}`) Mongo so'roviga tushmasin.
    const raw = req.body?.order_id || req.query?.order_id;
    const orderId = typeof raw === "string" || typeof raw === "number" ? String(raw).slice(0, 100) : "";
    if (!orderId) return res.status(400).send({ ok: false, msg: "inpay.missingOrderId" });
    // order_id avval SMS paket sotuvidan qidiriladi, topilmasa obuna to'lovi oqimi.
    if (await smsService.isSmsOrder(orderId)) await smsService.verifyAndCredit(orderId);
    else await subscriptionPaymentService.verifyAndActivate(orderId);
    return res.send({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
