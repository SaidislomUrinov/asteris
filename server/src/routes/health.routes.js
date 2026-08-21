const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const healthController = require("../controllers/health.controller");

const router = Router();

// Ochiq endpoint — auth yo'q. Suiiste'moldan himoya uchun IP bo'yicha
// 60 so'rov/daqiqa (API_CONTRACT.md §4.1).
const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).send({ ok: false, status: "rate_limited" }),
});

router.get("/", healthLimiter, healthController.check);

module.exports = router;
