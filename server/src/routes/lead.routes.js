const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const Admin = require("../models/Admin");
const leadController = require("../controllers/lead.controller");
const {
  adminAuth,
  fullAdminAuth,
  requirePermission,
} = require("../middlewares/authenticator.middleware");

const router = Router();

// Tashqi sayt/integratsiyalar shu orqali lead yuboradi. Admin auth (JWT) talab
// qilinmaydi, lekin `x-lead-api-key` header'i **majburiy** — haqiqiy admin
// kaliti bo'lmasa so'rov butunlay rad etiladi (lead yaratilmaydi).
const requireLeadApiKey = async (req, res, next) => {
  try {
    const key = req.headers["x-lead-api-key"];
    if (!key) throw new Error("lead.apiKeyRequired");

    const admin = await Admin.findOne({ apiKey: key }).select("_id");
    if (!admin) throw new Error("lead.apiKeyInvalid");

    req.leadSourceKey = key;
    next();
  } catch (error) {
    next(error);
  }
};

const keyedLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.leadSourceKey,
});

// Websitening "Bepul boshlash" modali — API-key TALAB QILINMAYDI (haqiqiy
// tashrifchi ochiq brauzerdan chaqiradi, kalitni yashirib bo'lmaydi), shu
// sabab bu yerda IP bo'yicha qattiq limit + controller darajasidagi honeypot
// bilan cheklaymiz (`requireLeadApiKey`dan FARQLI, unga tegilmaydi).
// 30/soat: mobil operatorlar (CGNAT) ko'p odamni bitta IP ortida chiqaradi —
// reklama paytida 10 juda kam edi va haqiqiy leadlar 429 olishi mumkin edi.
const publicLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/public", publicLeadLimiter, leadController.createPublic);
router.post("/", requireLeadApiKey, keyedLeadLimiter, leadController.create);

router.use(adminAuth, fullAdminAuth);

router.get("/", requirePermission("lead:view"), leadController.list);
router.get("/:id", requirePermission("lead:view"), leadController.getOne);
router.patch("/:id/status", leadController.updateStatus);
router.post("/:id/client", leadController.createClient);

module.exports = router;
