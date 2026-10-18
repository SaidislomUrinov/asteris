const { Router } = require("express");
const rateLimit = require("../utils/rateLimit.util");
const staffController = require("../controllers/staff.controller");
const { staffAuth, fullStaffAuth } = require("../middlewares/authenticator.middleware");

const router = Router();

// Brute-force himoyasi, ikki qavat (Redis'da, barcha worker'lar uchun umumiy):
// 1) bitta HISOBGA bir IP'dan 15 daqiqada 10 urinish — parol tanlash to'xtaydi;
// 2) bitta IP'dan jami 60 urinish — ko'p hisobni aylanib "spray" qilish to'xtaydi.
// Avval faqat IP bo'yicha 10 edi: bitta NAT ortidagi markazda ertalab 10+
// hodim kirganda qolganlari bloklanib qolardi.
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `${rateLimit.ipKey(req)}:${String(req.body?.phone || req.body?.login || "").trim().toLowerCase().slice(0, 64)}`,
});
const ipLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60 });
const signInLimiter = [ipLimiter, accountLimiter];

// Profil (parol almashtirish `currentPassword` bilan) — parolni tanlab
// ko'rishdan himoya; signin hisoblagichidan alohida.
const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/signin", signInLimiter, staffController.signIn);
router.get("/verify", staffAuth, fullStaffAuth, staffController.verify);
router.post("/signout", staffAuth, fullStaffAuth, staffController.signOutSession);
router.patch("/profile", profileLimiter, staffAuth, fullStaffAuth, staffController.updateOwnProfile);
router.patch("/phone", profileLimiter, staffAuth, fullStaffAuth, staffController.setOwnPhone);
router.patch("/intro-seen", staffAuth, fullStaffAuth, staffController.markIntroSeen);

module.exports = router;
