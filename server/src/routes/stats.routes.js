const { Router } = require("express");
const rateLimit = require("../utils/rateLimit.util");
const statsController = require("../controllers/stats.controller");

const router = Router();

// wenet.uz bosh sahifasi uchun — auth yo'q, natija Redis'da 10 daqiqa keshlanadi.
const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).send({ ok: false, message: "rate_limited" }),
});

router.get("/public", statsLimiter, statsController.publicStats);

module.exports = router;
