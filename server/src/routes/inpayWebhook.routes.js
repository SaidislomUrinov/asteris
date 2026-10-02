const { Router } = require("express");
const rateLimit = require("../utils/rateLimit.util");
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
    const orderId = req.body?.order_id || req.query?.order_id;
    if (!orderId) return res.status(400).send({ ok: false, msg: "inpay.missingOrderId" });
    await subscriptionPaymentService.verifyAndActivate(orderId);
    return res.send({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
