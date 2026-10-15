const { Router } = require("express");
const rateLimit = require("../utils/rateLimit.util");
const clientController = require("../controllers/client.controller");
const { clientAuth, fullClientAuth } = require("../middlewares/authenticator.middleware");

const router = Router();

// Brute-force himoyasi, ikki qavat (Redis'da, barcha worker'lar uchun umumiy):
// 1) bitta HISOBGA bir IP'dan 15 daqiqada 10 urinish — parol tanlash to'xtaydi;
// 2) bitta IP'dan jami 60 urinish — ko'p hisobni aylanib "spray" qilish to'xtaydi.
// Avval faqat IP bo'yicha 10 edi: bitta NAT ortidagi markazda ertalab 10+
// hodim kirganda qolganlari bloklanib qolardi.
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `${rateLimit.ipKey(req)}:${String(req.body?.phone || "").trim().toLowerCase().slice(0, 64)}`,
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

router.post("/signin", signInLimiter, clientController.signIn);
router.get("/verify", clientAuth, fullClientAuth, clientController.verify);
router.patch("/profile", profileLimiter, clientAuth, fullClientAuth, clientController.updateOwnProfile);
router.patch("/intro-seen", clientAuth, fullClientAuth, clientController.markIntroSeen);
router.post("/signout", clientAuth, fullClientAuth, clientController.signOutSession);
router.get("/tariffs", clientAuth, fullClientAuth, clientController.listTariffs);
router.post("/subscription/initiate", clientAuth, fullClientAuth, clientController.initiateSubscription);
router.get("/subscription/status/:orderId", clientAuth, fullClientAuth, clientController.subscriptionStatus);

module.exports = router;
