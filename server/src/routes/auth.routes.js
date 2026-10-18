const { Router } = require("express");
const rateLimit = require("../utils/rateLimit.util");
const authController = require("../controllers/auth.controller");

const router = Router();

// clientAuth/staffAuth bilan bir xil ikki qavatli brute-force himoyasi:
// (IP + raqam) bo'yicha 10, IP bo'yicha jami 60 urinish / 15 daqiqa.
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `${rateLimit.ipKey(req)}:${String(req.body?.phone || "").replace(/\D/g, "").slice(0, 32)}`,
});
const ipLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60 });

router.post("/signin", ipLimiter, accountLimiter, authController.signIn);

module.exports = router;
